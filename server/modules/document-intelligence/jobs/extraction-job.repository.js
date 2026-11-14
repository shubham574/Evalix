const { DocumentExtractionJob } = require('./extractionJob.model');

const createJobIdempotent = async (data, session = null) => {
  const {
    intakeId,
    documentId,
    documentChecksum,
    extractorVersion,
    schemaVersion,
  } = data;

  return DocumentExtractionJob.findOneAndUpdate(
    { intakeId, documentId: String(documentId), documentChecksum, extractorVersion, schemaVersion },
    { $setOnInsert: data },
    {
      upsert: true,
      new: true,
      ...(session ? { session } : {}),
    }
  ).exec();
};

/**
 * Atomically claim the next eligible job (QUEUED, RETRY_WAIT due now, or expired PROCESSING lease).
 * Prevents two concurrent workers from claiming the same job.
 */
const claimNextJob = async ({ workerId, leaseMs, documentType = null }) => {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  const query = {
    $or: [
      { status: 'QUEUED', nextAttemptAt: { $lte: now } },
      { status: 'RETRY_WAIT', nextAttemptAt: { $lte: now } },
      { status: 'PROCESSING', leaseExpiresAt: { $lte: now } },
    ],
  };
  if (documentType) {
    query.documentType = documentType;
  }

  return DocumentExtractionJob.findOneAndUpdate(
    query,
    {
      $set: {
        status: 'PROCESSING',
        lockedBy: workerId,
        lockedAt: now,
        leaseExpiresAt,
      },
      $inc: { attemptCount: 1 },
    },
    {
      sort: { nextAttemptAt: 1, createdAt: 1, _id: 1 },
      new: true,
    }
  ).exec();
};

const markJobCompleted = async (jobId, { extractionId }) => {
  return DocumentExtractionJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: 'COMPLETED',
        extractionId,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    },
    { new: true }
  ).exec();
};

const markJobTerminal = async (jobId, { status, errorCode, errorMessage }) => {
  return DocumentExtractionJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: errorCode || status,
        lastErrorMessage: (errorMessage || '').slice(0, 500),
      },
    },
    { new: true }
  ).exec();
};

const markJobRetryWait = async (jobId, { nextAttemptAt, errorCode, errorMessage }) => {
  return DocumentExtractionJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: 'RETRY_WAIT',
        nextAttemptAt,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: errorCode || 'TRANSIENT_ERROR',
        lastErrorMessage: (errorMessage || '').slice(0, 500),
      },
    },
    { new: true }
  ).exec();
};

const listJobsByRunId = async (runId) =>
  DocumentExtractionJob.find({ runId }).sort({ createdAt: 1 }).lean();

const requeueFailedJob = async (jobId, userId, reason) => {
  const now = new Date();
  return DocumentExtractionJob.findOneAndUpdate(
    {
      _id: jobId,
      userId,
      status: 'FAILED',
    },
    {
      $set: {
        status: 'QUEUED',
        nextAttemptAt: now,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        lastManualRetryAt: now,
      },
      $inc: { maximumAttempts: 1 },
      $push: {
        retryHistory: {
          retriedAt: now,
          reason: reason || 'Manual retry requested',
          triggeredBy: userId,
        },
      },
    },
    { new: true }
  ).exec();
};

module.exports = {
  createJobIdempotent,
  claimNextJob,
  markJobCompleted,
  markJobTerminal,
  markJobRetryWait,
  listJobsByRunId,
  requeueFailedJob,
};
