const mongoose = require('mongoose');
const env = require('../../config/env');
const AppError = require('../common/errors/AppError');
const { InterviewIntake } = require('../intake/interviewIntake.model');
const extractionRepo = require('./extraction/extraction.repository');
const jobRepo = require('./jobs/extraction-job.repository');
const { enqueueIntakeIntelligence, refreshRunStatus } = require('./extraction/extraction-orchestrator');

const verifyOwnedIntake = async (intakeId, userId) => {
  if (!mongoose.isValidObjectId(intakeId)) {
    throw new AppError(400, 'Invalid interview intake ID', 'INVALID_INTAKE_ID');
  }
  const intake = await InterviewIntake.findOne({ _id: intakeId, userId }).lean();
  if (!intake) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }
  return intake;
};

const getIntelligenceStatus = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  const run = await extractionRepo.findLatestRunByIntakeAndUser(intakeId, userId);

  if (!run) {
    return {
      intakeId: String(intakeId),
      status: 'NOT_STARTED',
      resume: { status: 'NOT_STARTED' },
      jobDescription: { status: 'NOT_STARTED' },
    };
  }

  const jobs = await jobRepo.listJobsByRunId(run._id);
  const resumeJob = jobs.find((j) => j.documentType === 'RESUME');
  const jdJob = jobs.find((j) => j.documentType === 'JOB_DESCRIPTION');

  return {
    intakeId: String(intakeId),
    runId: String(run._id),
    status: run.status,
    resume: {
      status: resumeJob?.status || 'UNKNOWN',
      attemptCount: resumeJob?.attemptCount || 0,
      lastErrorCode: resumeJob?.lastErrorCode || null,
    },
    jobDescription: {
      status: jdJob?.status || 'UNKNOWN',
      attemptCount: jdJob?.attemptCount || 0,
      lastErrorCode: jdJob?.lastErrorCode || null,
    },
    validationWarnings: run.validationWarnings || [],
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  };
};

const getExtractedResume = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  const run = await extractionRepo.findLatestRunByIntakeAndUser(intakeId, userId);
  if (!run || !run.resumeExtractionId) {
    throw new AppError(404, 'Resume extraction not available yet', 'EXTRACTION_NOT_READY');
  }

  const ext = run.resumeExtractionId;
  return {
    intakeId: String(intakeId),
    extractionId: String(ext._id),
    documentId: ext.documentId,
    extractionStatus: ext.extractionStatus,
    schemaVersion: ext.schemaVersion,
    extractorVersion: ext.extractorVersion,
    promptVersion: ext.promptVersion,
    resumeExtraction: ext.extractedData,
    validationWarnings: ext.validationWarnings || [],
    parserMetadata: ext.parserMetadata || {},
    completedAt: ext.completedAt,
  };
};

const getExtractedJobDescription = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  const run = await extractionRepo.findLatestRunByIntakeAndUser(intakeId, userId);
  if (!run || !run.jobDescriptionExtractionId) {
    throw new AppError(404, 'Job description extraction not available yet', 'EXTRACTION_NOT_READY');
  }

  const ext = run.jobDescriptionExtractionId;
  return {
    intakeId: String(intakeId),
    extractionId: String(ext._id),
    documentId: ext.documentId,
    extractionStatus: ext.extractionStatus,
    schemaVersion: ext.schemaVersion,
    extractorVersion: ext.extractorVersion,
    promptVersion: ext.promptVersion,
    jobDescriptionExtraction: ext.extractedData,
    validationWarnings: ext.validationWarnings || [],
    parserMetadata: ext.parserMetadata || {},
    completedAt: ext.completedAt,
  };
};

const getCompleteIntelligence = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  const run = await extractionRepo.findLatestRunByIntakeAndUser(intakeId, userId);
  if (!run) {
    throw new AppError(404, 'Intelligence run not found for intake', 'INTELLIGENCE_NOT_FOUND');
  }

  return {
    intakeId: String(intakeId),
    runId: String(run._id),
    status: run.status,
    resumeExtraction: run.resumeExtractionId?.extractedData || null,
    jobDescriptionExtraction: run.jobDescriptionExtractionId?.extractedData || null,
    extractionMetadata: {
      resume: run.resumeExtractionId
        ? {
            extractionId: String(run.resumeExtractionId._id),
            extractionStatus: run.resumeExtractionId.extractionStatus,
            schemaVersion: run.resumeExtractionId.schemaVersion,
            extractorVersion: run.resumeExtractionId.extractorVersion,
            promptVersion: run.resumeExtractionId.promptVersion,
            completedAt: run.resumeExtractionId.completedAt,
          }
        : null,
      jobDescription: run.jobDescriptionExtractionId
        ? {
            extractionId: String(run.jobDescriptionExtractionId._id),
            extractionStatus: run.jobDescriptionExtractionId.extractionStatus,
            schemaVersion: run.jobDescriptionExtractionId.schemaVersion,
            extractorVersion: run.jobDescriptionExtractionId.extractorVersion,
            promptVersion: run.jobDescriptionExtractionId.promptVersion,
            completedAt: run.jobDescriptionExtractionId.completedAt,
          }
        : null,
    },
    validationWarnings: run.validationWarnings || [],
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  };
};

const retryFailedExtraction = async (userId, intakeId, reason = 'Manual retry requested') => {
  const intake = await verifyOwnedIntake(intakeId, userId);
  if (!['READY_FOR_ANALYSIS', 'ANALYSIS_PENDING'].includes(intake.status)) {
    throw new AppError(
      409,
      'Intake must be submitted before retrying intelligence extraction',
      'INVALID_STATE_TRANSITION'
    );
  }

  let run = await extractionRepo.findLatestRunByIntakeAndUser(intakeId, userId);
  if (!run) {
    run = await enqueueIntakeIntelligence(intakeId);
    return {
      intakeId: String(intakeId),
      runId: String(run._id),
      retriedJobs: 2,
      status: run.status,
    };
  }

  const jobs = await jobRepo.listJobsByRunId(run._id);
  const failedJobs = jobs.filter((j) => j.status === 'FAILED');

  if (failedJobs.length === 0) {
    throw new AppError(
      409,
      'No eligible failed extraction jobs to retry',
      'NO_RETRYABLE_JOBS'
    );
  }

  const cooldownMs = Number(env.DOCUMENT_EXTRACTION_MANUAL_RETRY_COOLDOWN_MS) || 0;
  if (cooldownMs > 0) {
    const nowMs = Date.now();
    const latestManualRetryMs = failedJobs.reduce((latest, job) => {
      const ts = job.lastManualRetryAt ? new Date(job.lastManualRetryAt).getTime() : 0;
      return ts > latest ? ts : latest;
    }, 0);

    if (latestManualRetryMs > 0 && nowMs - latestManualRetryMs < cooldownMs) {
      const retryAfterSeconds = Math.max(1, Math.ceil((cooldownMs - (nowMs - latestManualRetryMs)) / 1000));
      throw new AppError(
        429,
        `Manual extraction retry is on cooldown. Please try again in ${retryAfterSeconds}s.`,
        'RETRY_COOLDOWN_ACTIVE'
      );
    }
  }

  let retriedCount = 0;
  for (const job of failedJobs) {
    const updated = await jobRepo.requeueFailedJob(job._id, userId, reason);
    if (updated) retriedCount += 1;
  }

  const updatedRun = await refreshRunStatus(run._id);

  return {
    intakeId: String(intakeId),
    runId: String(run._id),
    retriedJobs: retriedCount,
    status: updatedRun?.status || 'PENDING',
  };
};

module.exports = {
  getIntelligenceStatus,
  getExtractedResume,
  getExtractedJobDescription,
  getCompleteIntelligence,
  retryFailedExtraction,
};
