const crypto = require('crypto');
const env = require('../../../config/env');
const AppError = require('../../common/errors/AppError');
const { withTransaction } = require('../../common/db/transaction');
const { InterviewIntake } = require('../../intake/interviewIntake.model');
const { CandidateProfile } = require('../../candidate/candidateProfile.model');
const { CandidateExperience } = require('../../candidate/candidateExperience.model');
const { CandidateSkill } = require('../../candidate/candidateSkill.model');
const { CandidateProject } = require('../../candidate/candidateProject.model');
const { TargetJobProfile } = require('../../job-profile/targetJobProfile.model');
const { DocumentExtraction } = require('../../document-intelligence/extraction/documentExtraction.model');
const { IntakeIntelligenceRun } = require('../../document-intelligence/extraction/intakeIntelligenceRun.model');
const { buildCandidateFacts } = require('../candidate-profile/candidate-facts.service');
const { buildCandidateProfileSnapshot } = require('../candidate-profile/candidate-profile.builder');
const { normalizeJobRequirements } = require('../job-requirements/requirement-normalizer');
const { analyzeExperience } = require('../matching/experience-analyzer');
const { runDeterministicMatching } = require('../matching/deterministic-matcher');
const { runSemanticMatching } = require('../matching/semantic-matcher');
const analysisRepo = require('./analysis.repository');
const analysisJobRepo = require('../jobs/analysis-job.repository');

const SUPPORTED_EXTRACTION_STATUSES = new Set(['COMPLETED', 'COMPLETED_WITH_WARNINGS']);
const ANALYSIS_SCHEMA_VERSION = '1.0';

const verifyModule2Readiness = async (intakeId, userId = null) => {
  const intakeQuery = userId ? { _id: intakeId, userId } : { _id: intakeId };
  const intake = await InterviewIntake.findOne(intakeQuery).lean();
  if (!intake) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }

  if (!['READY_FOR_ANALYSIS', 'ANALYSIS_PENDING', 'COMPLETED'].includes(intake.status)) {
    throw new AppError(
      409,
      'Intake must be submitted before running candidate intelligence analysis',
      'INTAKE_NOT_ELIGIBLE'
    );
  }

  const run = await IntakeIntelligenceRun.findOne({ intakeId: intake._id })
    .sort({ createdAt: -1 })
    .lean();

  if (!run) {
    throw new AppError(
      409,
      'Document intelligence extraction has not started for this intake',
      'EXTRACTIONS_NOT_READY'
    );
  }

  if (intake.resumeDocumentId && String(run.resumeDocumentId) !== String(intake.resumeDocumentId)) {
    throw new AppError(
      409,
      'Resume extraction is stale relative to the current intake resume document',
      'STALE_EXTRACTION'
    );
  }

  const [resumeExt, jdExt, targetJob] = await Promise.all([
    run.resumeExtractionId ? DocumentExtraction.findById(run.resumeExtractionId).lean() : null,
    run.jobDescriptionExtractionId
      ? DocumentExtraction.findById(run.jobDescriptionExtractionId).lean()
      : null,
    TargetJobProfile.findById(intake.targetJobProfileId).lean(),
  ]);

  if (!resumeExt || !SUPPORTED_EXTRACTION_STATUSES.has(resumeExt.extractionStatus)) {
    throw new AppError(
      409,
      'Resume extraction is not completed',
      'RESUME_EXTRACTION_NOT_READY'
    );
  }

  if (!jdExt || !SUPPORTED_EXTRACTION_STATUSES.has(jdExt.extractionStatus)) {
    throw new AppError(
      409,
      'Job description extraction is not completed',
      'JD_EXTRACTION_NOT_READY'
    );
  }

  if (intake.resumeDocumentId && String(resumeExt.documentId) !== String(intake.resumeDocumentId)) {
    throw new AppError(409, 'Resume extraction documentId mismatch', 'STALE_EXTRACTION');
  }

  if (
    targetJob?.jobDescriptionDocumentId &&
    String(jdExt.documentId) !== String(targetJob.jobDescriptionDocumentId)
  ) {
    throw new AppError(409, 'JD extraction documentId mismatch', 'STALE_EXTRACTION');
  }

  return { intake, run, resumeExt, jdExt, targetJob };
};

const makeJobIdempotencyKey = ({
  intakeId,
  resumeExtractionId,
  jobDescriptionExtractionId,
  schemaVersion = ANALYSIS_SCHEMA_VERSION,
}) =>
  crypto
    .createHash('sha1')
    .update(`${intakeId}|${resumeExtractionId}|${jobDescriptionExtractionId}|${schemaVersion}`)
    .digest('hex');

const enqueueCandidateAnalysis = async (intakeId, { userId = null } = {}) => {
  const { intake, resumeExt, jdExt } = await verifyModule2Readiness(intakeId, userId);

  const existingAnalysis = await analysisRepo.findAnalysisBySourceExtractions({
    intakeId: intake._id,
    userId: intake.userId,
    resumeExtractionId: resumeExt._id,
    jobDescriptionExtractionId: jdExt._id,
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
  });

  if (existingAnalysis) {
    return {
      reused: true,
      analysis: existingAnalysis,
      job: await analysisJobRepo.findLatestJobByIntakeAndUser(intake._id, intake.userId),
    };
  }

  const idempotencyKey = makeJobIdempotencyKey({
    intakeId: intake._id,
    resumeExtractionId: resumeExt._id,
    jobDescriptionExtractionId: jdExt._id,
  });

  const job = await analysisJobRepo.createJobIdempotent({
    intakeId: intake._id,
    candidateProfileId: intake.candidateProfileId,
    userId: intake.userId,
    resumeExtractionId: resumeExt._id,
    jobDescriptionExtractionId: jdExt._id,
    idempotencyKey,
    status: 'QUEUED',
    maximumAttempts: env.CANDIDATE_INTELLIGENCE_MAX_ATTEMPTS,
    nextAttemptAt: new Date(),
  });

  return {
    reused: false,
    analysis: null,
    job,
  };
};

const buildEvidenceBasedSummary = ({
  candidateProfileSnapshot,
  assessments,
  experienceAnalysis,
  jobRequirementSnapshot,
}) => {
  const supported = assessments.filter((a) => a.assessment === 'SUPPORTED_DIRECTLY');
  const notEvidenced = assessments.filter((a) => a.assessment === 'NOT_EVIDENCED');
  const needsVerification = assessments.filter((a) => a.verificationNeeded);

  const primarySkills = (candidateProfileSnapshot.consolidatedSkills || [])
    .filter((s) => s.verificationStatus === 'EVIDENCED')
    .slice(0, 12)
    .map((s) => s.canonicalName);

  const projects = (candidateProfileSnapshot.projects || [])
    .slice(0, 8)
    .map((p) => p.value);

  const domainExperience = (candidateProfileSnapshot.domainExperience || []).map((d) => d.value);

  const unresolvedInconsistencies = [];
  if (
    typeof experienceAnalysis?.reportedExperienceMonths === 'number' &&
    experienceAnalysis.derivationStatus !== 'INSUFFICIENT_DATES' &&
    Math.abs(
      experienceAnalysis.reportedExperienceMonths - experienceAnalysis.derivedExperienceMonths
    ) > 6
  ) {
    unresolvedInconsistencies.push(
      `Candidate reported ${experienceAnalysis.reportedExperienceMonths} months vs ${experienceAnalysis.derivedExperienceMonths} months derived from employment dates.`
    );
  }

  const interviewFocusAreas = [
    ...notEvidenced.map((a) => ({
      competency: a.requirementName,
      requirementType: a.requirementType,
      reason: 'No supporting evidence was found in submitted materials.',
    })),
    ...needsVerification
      .filter((a) => a.assessment !== 'NOT_EVIDENCED')
      .map((a) => ({
        competency: a.requirementName,
        requirementType: a.requirementType,
        reason: a.explanation,
      })),
  ];

  return {
    summary: {
      candidateSummary: {
        professionalIdentity: candidateProfileSnapshot.professionalIdentity?.title || null,
        reportedExperienceMonths: experienceAnalysis?.reportedExperienceMonths ?? null,
        derivedExperienceMonths: experienceAnalysis?.derivedExperienceMonths ?? null,
        primaryTechnologies: primarySkills,
        domainExperience,
        projectExperience: projects,
      },
      strengthsSupportedByEvidence: supported.map((a) => ({
        requirementId: a.requirementId,
        requirementName: a.requirementName,
        evidenceReferences: a.evidenceReferences,
      })),
      missingInformation: [
        ...(jobRequirementSnapshot.missingInformation || []),
        ...notEvidenced.map((a) => a.requirementName),
      ],
      verificationItems: needsVerification.map((a) => ({
        requirementId: a.requirementId,
        requirementName: a.requirementName,
        assessment: a.assessment,
        reason: a.explanation,
      })),
      unresolvedInconsistencies,
    },
    interviewFocusAreas,
  };
};

const processAnalysisJob = async (job, { llmProvider = null } = {}) => {
  const startedAt = new Date();
  try {
    const { intake, resumeExt, jdExt, targetJob } = await verifyModule2Readiness(
      job.intakeId,
      job.userId
    );

    const existing = await analysisRepo.findAnalysisBySourceExtractions({
      intakeId: intake._id,
      userId: intake.userId,
      resumeExtractionId: resumeExt._id,
      jobDescriptionExtractionId: jdExt._id,
      schemaVersion: ANALYSIS_SCHEMA_VERSION,
    });

    if (existing) {
      await analysisJobRepo.markJobCompleted(job._id, { analysisId: existing._id });
      return { status: 'COMPLETED', analysisId: existing._id, cached: true };
    }

    const [candidateProfile, candidateExperiences, candidateSkills, candidateProjects] =
      await Promise.all([
        CandidateProfile.findById(intake.candidateProfileId).lean(),
        CandidateExperience.find({ candidateProfileId: intake.candidateProfileId }).lean(),
        CandidateSkill.find({ candidateProfileId: intake.candidateProfileId }).lean(),
        CandidateProject.find({ candidateProfileId: intake.candidateProfileId }).lean(),
      ]);

    const { facts, evidenceRegistry } = buildCandidateFacts({
      candidateProfile,
      candidateExperiences,
      candidateSkills,
      candidateProjects,
      resumeExtraction: resumeExt,
    });

    const candidateProfileSnapshot = buildCandidateProfileSnapshot({ facts, evidenceRegistry });
    const jobRequirementSnapshot = normalizeJobRequirements({
      jdExtraction: jdExt,
      targetJobProfile: targetJob,
    });

    const experienceAnalysis = analyzeExperience({
      facts,
      reportedExperienceMonths:
        candidateProfile?.totalExperienceMonths ??
        resumeExt.extractedData?.totalExperience?.reportedByCandidate ??
        null,
      jobRequiredMinimumMonths: jobRequirementSnapshot.minimumExperienceMonths,
    });

    const { assessments: deterministicAssessments, unmatchedRequirements } =
      runDeterministicMatching({
        requirements: jobRequirementSnapshot.requirements,
        facts,
        experienceAnalysis,
      });

    const semanticRes = await runSemanticMatching({
      unmatchedRequirements,
      facts,
      evidenceLookup: candidateProfileSnapshot.evidenceLookup,
      llmProvider,
      semanticEnabled: env.CANDIDATE_INTELLIGENCE_SEMANTIC_MATCHING_ENABLED,
    });

    const allAssessments = [...deterministicAssessments, ...semanticRes.assessments];
    const { summary, interviewFocusAreas } = buildEvidenceBasedSummary({
      candidateProfileSnapshot,
      assessments: allAssessments,
      experienceAnalysis,
      jobRequirementSnapshot,
    });

    const hasWarnings =
      (semanticRes.warnings || []).length > 0 ||
      resumeExt.extractionStatus === 'COMPLETED_WITH_WARNINGS' ||
      jdExt.extractionStatus === 'COMPLETED_WITH_WARNINGS';

    const analysisStatus =
      allAssessments.some((a) => a.verificationNeeded) || hasWarnings
        ? 'AWAITING_CANDIDATE_REVIEW'
        : 'AWAITING_CANDIDATE_REVIEW';

    const analysisDoc = await withTransaction(async (session) => {
      const version = await analysisRepo.getNextAnalysisVersion(intake._id, session);
      const created = await analysisRepo.createAnalysis(
        {
          intakeId: intake._id,
          candidateProfileId: intake.candidateProfileId,
          userId: intake.userId,
          targetJobProfileId: intake.targetJobProfileId,
          resumeExtractionId: resumeExt._id,
          jobDescriptionExtractionId: jdExt._id,
          analysisVersion: version,
          schemaVersion: ANALYSIS_SCHEMA_VERSION,
          analysisStatus,
          candidateProfileSnapshot,
          jobRequirementSnapshot,
          experienceAnalysis,
          summary,
          interviewFocusAreas,
          validationWarnings: [...(semanticRes.warnings || [])],
          sourceVersions: {
            resumeExtractionId: String(resumeExt._id),
            jobDescriptionExtractionId: String(jdExt._id),
            resumeSchemaVersion: resumeExt.schemaVersion,
            jdSchemaVersion: jdExt.schemaVersion,
            semanticModel: semanticRes.model || null,
            tokenUsage: semanticRes.tokenUsage || 0,
          },
          startedAt,
          completedAt: new Date(),
        },
        session
      );

      await analysisRepo.upsertRequirementAssessments(
        created._id,
        intake._id,
        intake.userId,
        allAssessments,
        session
      );

      await analysisRepo.supersedePreviousAnalyses(intake._id, created._id, session);
      return created;
    });

    await analysisJobRepo.markJobCompleted(job._id, { analysisId: analysisDoc._id });
    return { status: 'COMPLETED', analysisId: analysisDoc._id, cached: false };
  } catch (err) {
    const isPermanent =
      err instanceof AppError &&
      ['INTAKE_NOT_FOUND', 'INTAKE_NOT_ELIGIBLE', 'STALE_EXTRACTION'].includes(err.code);

    if (!isPermanent && job.attemptCount < job.maximumAttempts) {
      const delay = env.CANDIDATE_INTELLIGENCE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, job.attemptCount - 1));
      await analysisJobRepo.markJobRetryWait(job._id, {
        nextAttemptAt: new Date(Date.now() + delay),
        errorCode: err.code || err.category || 'TRANSIENT_ERROR',
        errorMessage: err.message,
      });
      return { status: 'RETRY_WAIT' };
    }

    await analysisJobRepo.markJobFailed(job._id, {
      errorCode: err.code || err.category || 'ANALYSIS_FAILED',
      errorMessage: err.message,
    });
    return { status: 'FAILED', error: err.message };
  }
};

const reconcilePendingAnalyses = async () => {
  const completedRuns = await IntakeIntelligenceRun.find({
    status: { $in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] },
    resumeExtractionId: { $ne: null },
    jobDescriptionExtractionId: { $ne: null },
  }).lean();

  let enqueuedCount = 0;
  for (const run of completedRuns) {
    try {
      const res = await enqueueCandidateAnalysis(run.intakeId, { userId: run.userId });
      if (!res.reused) enqueuedCount += 1;
    } catch {
      // Skip intakes whose extractions are not ready or stale
    }
  }
  return enqueuedCount;
};

module.exports = {
  verifyModule2Readiness,
  enqueueCandidateAnalysis,
  processAnalysisJob,
  reconcilePendingAnalyses,
  ANALYSIS_SCHEMA_VERSION,
};
