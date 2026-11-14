const crypto = require('crypto');
const env = require('../../../config/env');
const AppError = require('../../common/errors/AppError');
const { withTransaction } = require('../../common/db/transaction');
const { InterviewIntake } = require('../../intake/interviewIntake.model');
const { CandidateJobAnalysis } = require('../../candidate-intelligence/analysis/candidateJobAnalysis.model');
const { CandidateRequirementAssessment } = require('../../candidate-intelligence/analysis/candidateRequirementAssessment.model');
const { IntakeIntelligenceRun } = require('../../document-intelligence/extraction/intakeIntelligenceRun.model');
const { buildCompetencyPlan } = require('./competency-planner');
const { planStages } = require('./stage-planner');
const { generateQuestionsForBlueprint, QUESTION_GENERATOR_VERSION, QUESTION_PROMPT_VERSION } = require('../question-engine/question-generator');
const { generateRubricsForQuestions, RUBRIC_VERSION } = require('../assessment/rubric-generator');
const { validateBlueprint } = require('../validation/blueprint.validator');
const blueprintRepo = require('../interview-blueprint.repository');
const blueprintJobRepo = require('../jobs/blueprint-job.repository');

const PLANNING_CONFIGURATION_VERSION = '1.0.0';

const verifyModule3Readiness = async (intakeId, userId = null) => {
  const intakeQuery = userId ? { _id: intakeId, userId } : { _id: intakeId };
  const intake = await InterviewIntake.findOne(intakeQuery).lean();
  if (!intake) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }

  const analysis = await CandidateJobAnalysis.findOne({ intakeId: intake._id })
    .sort({ analysisVersion: -1 })
    .lean();

  if (!analysis) {
    throw new AppError(
      409,
      'Candidate intelligence analysis has not been completed for this intake',
      'ANALYSIS_NOT_FOUND'
    );
  }

  if (analysis.analysisStatus !== 'READY_FOR_INTERVIEW_PLANNING') {
    throw new AppError(
      409,
      `Candidate review must be completed before blueprint generation (current status: ${analysis.analysisStatus})`,
      'CANDIDATE_REVIEW_INCOMPLETE'
    );
  }

  if (!analysis.jobRequirementSnapshot || !(analysis.reviewedProfileSnapshot || analysis.candidateProfileSnapshot)) {
    throw new AppError(
      409,
      'Candidate analysis snapshots are incomplete',
      'INCOMPLETE_ANALYSIS_SNAPSHOT'
    );
  }

  // Verify source extraction versions are not stale relative to Module 2 run
  const latestRun = await IntakeIntelligenceRun.findOne({ intakeId: intake._id })
    .sort({ createdAt: -1 })
    .lean();

  if (latestRun) {
    if (
      latestRun.resumeExtractionId &&
      String(analysis.resumeExtractionId) !== String(latestRun.resumeExtractionId)
    ) {
      throw new AppError(409, 'Candidate analysis is stale relative to latest resume extraction', 'STALE_ANALYSIS_SOURCE');
    }
    if (
      latestRun.jobDescriptionExtractionId &&
      String(analysis.jobDescriptionExtractionId) !== String(latestRun.jobDescriptionExtractionId)
    ) {
      throw new AppError(409, 'Candidate analysis is stale relative to latest JD extraction', 'STALE_ANALYSIS_SOURCE');
    }
  }

  const assessments = await CandidateRequirementAssessment.find({ analysisId: analysis._id }).lean();
  return { intake, analysis, assessments };
};

const resolveInterviewConfig = (intake, overrides = {}) => {
  const prefs = intake.interviewPreferences || {};
  const interviewType = overrides.interviewType || prefs.interviewType || 'MIXED';
  const durationMinutes =
    Number(overrides.durationMinutes) ||
    Number(prefs.durationMinutes) ||
    env.INTERVIEW_BLUEPRINT_DEFAULT_DURATION_MINUTES;

  return {
    interviewType,
    durationMinutes,
    totalDurationSeconds: durationMinutes * 60,
  };
};

const makeBlueprintIdempotencyKey = ({
  intakeId,
  candidateAnalysisId,
  interviewType,
  totalDurationSeconds,
  regenerationNonce = '',
}) =>
  crypto
    .createHash('sha1')
    .update(
      `${intakeId}|${candidateAnalysisId}|${interviewType}|${totalDurationSeconds}|${PLANNING_CONFIGURATION_VERSION}|${regenerationNonce}`
    )
    .digest('hex');

const enqueueBlueprintGeneration = async (
  intakeId,
  { userId = null, interviewType, durationMinutes, regenerate = false, regenerationReason = null } = {}
) => {
  const { intake, analysis } = await verifyModule3Readiness(intakeId, userId);
  const config = resolveInterviewConfig(intake, { interviewType, durationMinutes });

  if (regenerate) {
    const activeLocked = await blueprintRepo.findLatestReadyOrReviewByIntakeAndUser(
      intake._id,
      intake.userId
    );
    if (activeLocked?.isLockedForSession) {
      throw new AppError(
        409,
        'Cannot regenerate blueprint because an active interview session has already locked it',
        'BLUEPRINT_LOCKED_FOR_SESSION'
      );
    }
  } else {
    const reusable = await blueprintRepo.findReusableBlueprint({
      intakeId: intake._id,
      userId: intake.userId,
      candidateAnalysisId: analysis._id,
      interviewType: config.interviewType,
      totalDurationSeconds: config.totalDurationSeconds,
    });

    if (reusable) {
      return {
        reused: true,
        blueprint: reusable,
        job: await blueprintJobRepo.findLatestJobByIntakeAndUser(intake._id, intake.userId),
      };
    }
  }

  const idempotencyKey = makeBlueprintIdempotencyKey({
    intakeId: intake._id,
    candidateAnalysisId: analysis._id,
    interviewType: config.interviewType,
    totalDurationSeconds: config.totalDurationSeconds,
    regenerationNonce: regenerate ? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : '',
  });

  const job = await blueprintJobRepo.createJobIdempotent({
    intakeId: intake._id,
    candidateProfileId: intake.candidateProfileId,
    userId: intake.userId,
    candidateAnalysisId: analysis._id,
    idempotencyKey,
    status: 'QUEUED',
    maximumAttempts: env.INTERVIEW_BLUEPRINT_MAX_ATTEMPTS,
    nextAttemptAt: new Date(),
    regenerationReason: regenerate ? regenerationReason || 'Manual blueprint regeneration' : null,
    requestedConfig: config,
  });

  return {
    reused: false,
    blueprint: null,
    job,
  };
};

const processBlueprintJob = async (job, { llmProvider = null } = {}) => {
  let stageMarker = 'INPUT_VALIDATION';
  try {
    const { intake, analysis, assessments } = await verifyModule3Readiness(
      job.intakeId,
      job.userId
    );

    const config = resolveInterviewConfig(intake, job.requestedConfig || {});
    const profileSnapshot = analysis.reviewedProfileSnapshot || analysis.candidateProfileSnapshot;
    const reviewedFacts = profileSnapshot?.facts || [];
    const jobReqSnapshot = analysis.jobRequirementSnapshot || {};
    const targetRole = jobReqSnapshot.jobTitle || 'Software Engineer';
    const seniorityLevel =
      jobReqSnapshot.seniorityLevel ||
      profileSnapshot?.professionalIdentity?.experienceLevel ||
      'MID';

    stageMarker = 'COMPETENCY_PLANNING';
    const compPlanResult = buildCompetencyPlan({
      requirements: jobReqSnapshot.requirements || [],
      assessments,
      durationMinutes: config.durationMinutes,
      interviewType: config.interviewType,
      seniorityLevel,
    });

    stageMarker = 'STAGE_PLANNING';
    const stagePlanResult = planStages({
      targetRole,
      interviewType: config.interviewType,
      durationMinutes: config.durationMinutes,
      competencies: compPlanResult.competencies,
    });

    stageMarker = 'QUESTION_GENERATION';
    const qGenResult = await generateQuestionsForBlueprint({
      competencies: compPlanResult.competencies,
      stages: stagePlanResult.stages,
      reviewedFacts,
      targetRole,
      seniorityLevel,
      practicalMode: stagePlanResult.practicalMode,
      llmProvider,
    });

    // Attach plannedQuestionIds to their respective stages
    const stagesWithQuestions = stagePlanResult.stages.map((s) => ({
      ...s,
      plannedQuestionIds: qGenResult.questions
        .filter((q) => q.stageId === s.stageId)
        .map((q) => q.questionId),
    }));

    stageMarker = 'RUBRIC_GENERATION';
    const evaluationRubrics = generateRubricsForQuestions({
      questions: qGenResult.questions,
      competencies: compPlanResult.competencies,
    });

    const rubricReferences = Object.fromEntries(
      evaluationRubrics.map((r) => [r.questionId, r.rubricId])
    );

    stageMarker = 'QUALITY_VALIDATION';
    const validation = validateBlueprint({
      totalDurationSeconds: stagePlanResult.totalDurationSeconds,
      stages: stagesWithQuestions,
      competencyPlan: compPlanResult.competencies,
      excludedRequirements: compPlanResult.excludedRequirements,
      questions: qGenResult.questions,
      evaluationRubrics,
      reviewedFacts,
      jobRequirements: jobReqSnapshot.requirements || [],
    });

    const finalStatus = validation.isValid ? 'READY' : 'NEEDS_REVIEW';
    const allWarnings = [
      ...(qGenResult.warnings || []),
      ...(validation.warnings || []),
      ...(validation.errors || []),
    ];

    stageMarker = 'PERSISTENCE';
    const createdBlueprint = await withTransaction(async (session) => {
      const version = await blueprintRepo.getNextBlueprintVersion(intake._id, session);
      const created = await blueprintRepo.createBlueprint(
        {
          intakeId: intake._id,
          candidateProfileId: intake.candidateProfileId,
          userId: intake.userId,
          candidateAnalysisId: analysis._id,
          blueprintVersion: version,
          status: finalStatus,
          interviewType: config.interviewType,
          targetRole,
          roleFamily: stagePlanResult.roleFamily,
          seniorityLevel,
          totalDurationSeconds: stagePlanResult.totalDurationSeconds,
          competencyPlan: compPlanResult.competencies,
          excludedRequirements: compPlanResult.excludedRequirements,
          stages: stagesWithQuestions,
          questionPlan: qGenResult.questions,
          evaluationRubrics,
          rubricReferences,
          planningConfigurationVersion: PLANNING_CONFIGURATION_VERSION,
          promptVersions: {
            questionPrompt: QUESTION_PROMPT_VERSION,
            questionGenerator: QUESTION_GENERATOR_VERSION,
            rubricVersion: RUBRIC_VERSION,
          },
          modelMetadata: {
            provider: qGenResult.provider,
            model: qGenResult.model,
            tokenUsage: qGenResult.tokenUsage || 0,
          },
          sourceVersions: {
            candidateAnalysisId: String(analysis._id),
            analysisVersion: analysis.analysisVersion,
            resumeExtractionId: String(analysis.resumeExtractionId),
            jobDescriptionExtractionId: String(analysis.jobDescriptionExtractionId),
            profileReviewVersion: profileSnapshot?.reviewEventCount ?? 0,
            schemaVersion: '1.0',
          },
          generationWarnings: allWarnings,
          regenerationReason: job.regenerationReason || null,
        },
        session
      );

      await blueprintRepo.supersedePreviousBlueprints(intake._id, created._id, session);
      return created;
    });

    await blueprintJobRepo.markJobCompleted(job._id, { blueprintId: createdBlueprint._id });
    return { status: 'COMPLETED', blueprintId: createdBlueprint._id, blueprintStatus: finalStatus };
  } catch (err) {
    const isPermanent =
      err instanceof AppError &&
      ['INTAKE_NOT_FOUND', 'ANALYSIS_NOT_FOUND', 'CANDIDATE_REVIEW_INCOMPLETE', 'STALE_ANALYSIS_SOURCE'].includes(
        err.code
      );

    if (!isPermanent && job.attemptCount < job.maximumAttempts) {
      const delay = env.INTERVIEW_BLUEPRINT_RETRY_DELAY_MS * Math.pow(2, Math.max(0, job.attemptCount - 1));
      await blueprintJobRepo.markJobRetryWait(job._id, {
        nextAttemptAt: new Date(Date.now() + delay),
        failureStage: stageMarker,
        errorCode: err.code || err.category || 'TRANSIENT_ERROR',
        errorMessage: err.message,
      });
      return { status: 'RETRY_WAIT' };
    }

    await blueprintJobRepo.markJobFailed(job._id, {
      failureStage: stageMarker,
      errorCode: err.code || err.category || 'BLUEPRINT_FAILED',
      errorMessage: err.message,
    });
    return { status: 'FAILED', error: err.message };
  }
};

const reconcilePendingBlueprints = async () => {
  const readyAnalyses = await CandidateJobAnalysis.find({
    analysisStatus: 'READY_FOR_INTERVIEW_PLANNING',
  }).lean();

  let count = 0;
  for (const a of readyAnalyses) {
    try {
      const res = await enqueueBlueprintGeneration(a.intakeId, { userId: a.userId });
      if (!res.reused) count += 1;
    } catch {
      // Skip analyses whose sources are incomplete or stale
    }
  }
  return count;
};

module.exports = {
  PLANNING_CONFIGURATION_VERSION,
  verifyModule3Readiness,
  enqueueBlueprintGeneration,
  processBlueprintJob,
  reconcilePendingBlueprints,
};
