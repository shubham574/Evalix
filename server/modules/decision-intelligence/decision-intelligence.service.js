const crypto = require('crypto');
const AppError = require('../common/errors/AppError');
const env = require('../../config/env');
const { CandidateProfile } = require('../candidate/candidateProfile.model');
const {
  CandidateRequirementAssessment,
} = require('../candidate-intelligence/analysis/candidateRequirementAssessment.model');
const { InterviewBlueprint } = require('../interview-blueprint/models/interviewBlueprint.model');
const InterviewTurn = require('../interview-orchestrator/turns/interviewTurn.model');
const { findSession } = require('../interview-evaluation/assembly/session-assembler');
const {
  InterviewEvaluationRun,
} = require('../interview-evaluation/models/interviewEvaluationRun.model');
const { QuestionEvaluation } = require('../interview-evaluation/models/questionEvaluation.model');
const { CompetencyEvaluation } = require('../interview-evaluation/models/competencyEvaluation.model');
const { StudentPracticeReport } = require('./reports/studentPracticeReport.model');
const { CandidateDevelopmentPlan } = require('./development/candidateDevelopmentPlan.model');
const { EvaluationQualityReport } = require('./quality/evaluationQualityReport.model');
const { runEvaluationQualityChecks } = require('./quality/evaluationQuality.service');
const {
  buildStudentPracticeInsights,
  STUDENT_FEEDBACK_PROMPT_VERSION,
} = require('./coaching/student-insight.service');
const {
  generateDevelopmentPlanContent,
  DEV_PLAN_PROMPT_VERSION,
} = require('./development/development-plan.generator');
const { recordCalibrationObservationsForRun } = require('./calibration/calibration.service');
const jobRepo = require('./jobs/decision-intelligence-job.repository');

const ELIGIBLE_EVAL_STATUSES = new Set([
  'COMPLETED',
  'COMPLETED_WITH_WARNINGS',
  'INSUFFICIENT_COVERAGE',
  'NEEDS_REVIEW',
]);

const loadEligibleEvaluationBundle = async (
  sessionIdOrUuid,
  { userId = null, bypassOwnership = false } = {}
) => {
  const session = await findSession(sessionIdOrUuid);
  if (!session) {
    throw new AppError(404, 'Interview session not found', 'SESSION_NOT_FOUND');
  }

  if (!bypassOwnership && session.userId !== userId) {
    throw new AppError(403, 'Not authorized to access this interview session', 'SESSION_FORBIDDEN');
  }

  const evaluationRun = await InterviewEvaluationRun.findOne({
    sessionId: session._id,
    status: { $ne: 'SUPERSEDED' },
  })
    .sort({ evaluationVersion: -1 })
    .lean();

  if (!evaluationRun) {
    throw new AppError(404, 'Completed evaluation run not found for session', 'EVALUATION_NOT_FOUND');
  }

  if (!ELIGIBLE_EVAL_STATUSES.has(evaluationRun.status)) {
    throw new AppError(
      409,
      `Evaluation run status '${evaluationRun.status}' is not eligible for student coaching`,
      'EVALUATION_NOT_READY'
    );
  }

  const [
    questionEvaluations,
    competencyEvaluations,
    blueprintDoc,
    turns,
    candidateProfile,
    requirementAssessments,
  ] = await Promise.all([
    QuestionEvaluation.find({ evaluationRunId: evaluationRun._id }).lean(),
    CompetencyEvaluation.find({ evaluationRunId: evaluationRun._id }).lean(),
    InterviewBlueprint.findById(session.blueprintId).lean(),
    InterviewTurn.find({ sessionId: session._id }).sort({ turnNumber: 1 }).lean(),
    CandidateProfile.findById(session.candidateProfileId).lean(),
    CandidateRequirementAssessment.find({ analysisId: session.candidateAnalysisId }).lean(),
  ]);

  return {
    session,
    evaluationRun,
    questionEvaluations,
    competencyEvaluations,
    blueprintDoc,
    turns,
    candidateProfile,
    requirementAssessments,
  };
};

const enqueueStudentLearningInsightsJob = async ({ sessionIdOrUuid, userId }) => {
  const { session, evaluationRun } = await loadEligibleEvaluationBundle(sessionIdOrUuid, {
    userId,
  });

  const existing = await StudentPracticeReport.findOne({
    sessionId: session._id,
    evaluationRunId: evaluationRun._id,
    'sourceVersions.evaluationVersion': evaluationRun.evaluationVersion,
    'sourceVersions.reviewVersion': evaluationRun.latestReviewVersion || 0,
    generationStatus: 'GENERATED',
  })
    .sort({ reportVersion: -1 })
    .lean();

  if (existing) {
    return { deduplicated: true, report: existing, job: null };
  }

  const idempotencyKey = crypto
    .createHash('sha256')
    .update(
      `SLI:${session._id}:${evaluationRun._id}:${evaluationRun.evaluationVersion}:${evaluationRun.latestReviewVersion || 0}:${STUDENT_FEEDBACK_PROMPT_VERSION}`
    )
    .digest('hex');

  const job = await jobRepo.createJobIdempotent({
    sessionId: session._id,
    evaluationRunId: evaluationRun._id,
    organizationId: session.organizationId || null,
    jobType: 'STUDENT_LEARNING_INSIGHTS',
    idempotencyKey,
    status: 'QUEUED',
    maximumAttempts: env.DECISION_INTELLIGENCE_MAX_ATTEMPTS,
    nextAttemptAt: new Date(),
  });

  return { deduplicated: false, report: null, job };
};

const executeStudentLearningInsightsGeneration = async (
  { sessionIdOrUuid },
  { llmProvider = null } = {}
) => {
  const bundle = await loadEligibleEvaluationBundle(sessionIdOrUuid, {
    bypassOwnership: true,
  });

  // Internal quality check (never exposes raw diagnostics to student report)
  const qualityReport = await runEvaluationQualityChecks(bundle);

  // Internal calibration telemetry only (when organizationId exists)
  if (bundle.session.organizationId) {
    await recordCalibrationObservationsForRun({
      organizationId: bundle.session.organizationId,
      evaluationRun: bundle.evaluationRun,
      questionEvaluations: bundle.questionEvaluations,
    });
  }

  const insightData = await buildStudentPracticeInsights(
    { ...bundle, qualityReport },
    { llmProvider }
  );

  const latest = await StudentPracticeReport.findOne({
    sessionId: bundle.session._id,
  })
    .sort({ reportVersion: -1 })
    .lean();

  if (latest) {
    await StudentPracticeReport.updateMany(
      { sessionId: bundle.session._id, generationStatus: 'GENERATED' },
      { $set: { generationStatus: 'SUPERSEDED' } }
    );
  }

  const nextVersion = latest ? latest.reportVersion + 1 : 1;

  const created = await StudentPracticeReport.create({
    candidateProfileId: bundle.session.candidateProfileId,
    userId: bundle.session.userId,
    intakeId: bundle.session.intakeId,
    sessionId: bundle.session._id,
    sessionUuid: bundle.session.sessionId,
    evaluationRunId: bundle.evaluationRun._id,
    reportVersion: nextVersion,
    ...insightData,
    generationStatus: 'GENERATED',
  });

  return { report: created.toObject(), qualityReport };
};

const getLatestStudentPracticeReport = async ({ sessionIdOrUuid, userId }) => {
  const session = await findSession(sessionIdOrUuid);
  if (!session) {
    throw new AppError(404, 'Interview session not found', 'SESSION_NOT_FOUND');
  }
  if (session.userId !== userId) {
    throw new AppError(403, 'Not authorized to access this practice report', 'SESSION_FORBIDDEN');
  }

  const report = await StudentPracticeReport.findOne({
    sessionId: session._id,
    generationStatus: 'GENERATED',
  })
    .sort({ reportVersion: -1 })
    .lean();

  if (!report) {
    throw new AppError(404, 'Student practice insights not found for session', 'REPORT_NOT_FOUND');
  }

  return report;
};

const getAnswerImprovementGuidance = async ({ sessionIdOrUuid, userId }) => {
  const report = await getLatestStudentPracticeReport({ sessionIdOrUuid, userId });
  return {
    sessionId: report.sessionUuid,
    reportVersion: report.reportVersion,
    practiceMode: report.practiceMode,
    targetRole: report.targetRole,
    answers: report.answerImprovementGuidance || [],
  };
};

const enqueueDevelopmentPlanJob = async ({ sessionIdOrUuid, userId }) => {
  const { session, evaluationRun } = await loadEligibleEvaluationBundle(sessionIdOrUuid, {
    userId,
  });

  const existing = await CandidateDevelopmentPlan.findOne({
    sessionId: session._id,
    evaluationRunId: evaluationRun._id,
    status: { $ne: 'SUPERSEDED' },
  })
    .sort({ planVersion: -1 })
    .lean();

  if (existing) {
    return { deduplicated: true, plan: existing, job: null };
  }

  const idempotencyKey = crypto
    .createHash('sha256')
    .update(
      `DP:${session._id}:${evaluationRun._id}:${evaluationRun.evaluationVersion}:${DEV_PLAN_PROMPT_VERSION}`
    )
    .digest('hex');

  const job = await jobRepo.createJobIdempotent({
    sessionId: session._id,
    evaluationRunId: evaluationRun._id,
    organizationId: null,
    jobType: 'DEVELOPMENT_PLAN',
    idempotencyKey,
    status: 'QUEUED',
    maximumAttempts: env.DECISION_INTELLIGENCE_MAX_ATTEMPTS,
    nextAttemptAt: new Date(),
  });

  return { deduplicated: false, plan: null, job };
};

const executeDevelopmentPlanGeneration = async (
  { sessionIdOrUuid },
  { llmProvider = null } = {}
) => {
  const bundle = await loadEligibleEvaluationBundle(sessionIdOrUuid, {
    bypassOwnership: true,
  });

  const content = await generateDevelopmentPlanContent(
    {
      competencyEvaluations: bundle.competencyEvaluations,
      questionEvaluations: bundle.questionEvaluations,
      session: bundle.session,
      evaluationRun: bundle.evaluationRun,
    },
    { llmProvider }
  );

  const latest = await CandidateDevelopmentPlan.findOne({
    sessionId: bundle.session._id,
  })
    .sort({ planVersion: -1 })
    .lean();

  if (latest) {
    await CandidateDevelopmentPlan.updateMany(
      { sessionId: bundle.session._id, status: 'ACTIVE' },
      { $set: { status: 'SUPERSEDED', planStatus: 'SUPERSEDED' } }
    );
  }

  const nextVersion = latest ? latest.planVersion + 1 : 1;

  const created = await CandidateDevelopmentPlan.create({
    candidateProfileId: bundle.session.candidateProfileId,
    userId: bundle.session.userId,
    intakeId: bundle.session.intakeId,
    sessionId: bundle.session._id,
    sessionUuid: bundle.session.sessionId,
    evaluationRunId: bundle.evaluationRun._id,
    planVersion: nextVersion,
    previousPlanVersion: latest ? latest.planVersion : null,
    practiceMode: bundle.session.practiceMode || 'REALISTIC_MOCK',
    targetRole: bundle.session.targetRole || '',
    targetCompetencyIds: content.targetCompetencyIds || [],
    sourceQuestionIds: content.sourceQuestionIds || [],
    sourceEvaluationVersion: bundle.evaluationRun.evaluationVersion,
    planTitle: content.planTitle,
    overallObjective: content.overallObjective,
    status: 'ACTIVE',
    planStatus: 'ACTIVE',
    summary: content.summary,
    objectives: content.objectives,
    improvementObjectives: content.improvementObjectives,
    sourceEvaluationReferences: bundle.questionEvaluations.map((q) => q.questionId),
    llmMetadata: content.llmMetadata,
    generatedAt: new Date(),
  });

  return created.toObject();
};

const getLatestDevelopmentPlan = async ({ sessionIdOrUuid, userId }) => {
  const session = await findSession(sessionIdOrUuid);
  if (!session) {
    throw new AppError(404, 'Interview session not found', 'SESSION_NOT_FOUND');
  }
  if (session.userId !== userId) {
    throw new AppError(403, 'Not authorized to access this development plan', 'PLAN_FORBIDDEN');
  }

  const plan = await CandidateDevelopmentPlan.findOne({
    sessionId: session._id,
    status: { $ne: 'SUPERSEDED' },
  })
    .sort({ planVersion: -1 })
    .lean();

  if (!plan) {
    throw new AppError(404, 'Candidate development plan not found', 'PLAN_NOT_FOUND');
  }

  return plan;
};

// Internal-only quality report lookup (never exposed to student routes)
const getInternalQualityReport = async ({ sessionIdOrUuid }) => {
  const session = await findSession(sessionIdOrUuid);
  if (!session) {
    throw new AppError(404, 'Interview session not found', 'SESSION_NOT_FOUND');
  }

  const report = await EvaluationQualityReport.findOne({ sessionId: session._id })
    .sort({ qualityCheckVersion: -1 })
    .lean();

  if (!report) {
    throw new AppError(404, 'Evaluation quality report not found', 'QUALITY_REPORT_NOT_FOUND');
  }

  return report;
};

module.exports = {
  loadEligibleEvaluationBundle,
  enqueueStudentLearningInsightsJob,
  executeStudentLearningInsightsGeneration,
  getLatestStudentPracticeReport,
  getAnswerImprovementGuidance,
  enqueueDevelopmentPlanJob,
  executeDevelopmentPlanGeneration,
  getLatestDevelopmentPlan,
  getInternalQualityReport,
};
