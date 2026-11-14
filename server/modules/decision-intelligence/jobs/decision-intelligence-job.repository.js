const { DecisionIntelligenceJob } = require('./decisionIntelligenceJob.model');

const createJobIdempotent = async (payload) =>
  DecisionIntelligenceJob.findOneAndUpdate(
    { idempotencyKey: payload.idempotencyKey },
    { $setOnInsert: payload },
    { upsert: true, returnDocument: 'after' }
  ).lean();

const claimNextJob = async ({ workerId, leaseMs }) => {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  return DecisionIntelligenceJob.findOneAndUpdate(
    {
      $or: [
        { status: 'QUEUED', nextAttemptAt: { $lte: now } },
        { status: 'RETRY_WAIT', nextAttemptAt: { $lte: now } },
        { status: 'PROCESSING', leaseExpiresAt: { $lte: now } },
      ],
    },
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
      sort: { nextAttemptAt: 1, createdAt: 1 },
      returnDocument: 'after',
    }
  ).exec();
};

const markJobCompleted = async (jobId) =>
  DecisionIntelligenceJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: 'COMPLETED',
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        failureStage: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    },
    { returnDocument: 'after' }
  ).exec();

const markJobRetryWait = async (
  jobId,
  { nextAttemptAt, failureStage, errorCode, errorMessage }
) =>
  DecisionIntelligenceJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: 'RETRY_WAIT',
        nextAttemptAt,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        failureStage: failureStage || 'GENERATION',
        lastErrorCode: errorCode || 'TRANSIENT_ERROR',
        lastErrorMessage: String(errorMessage || '').slice(0, 500),
      },
    },
    { returnDocument: 'after' }
  ).exec();

const markJobFailed = async (jobId, { failureStage, errorCode, errorMessage }) =>
  DecisionIntelligenceJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: 'FAILED',
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        failureStage: failureStage || 'GENERATION',
        lastErrorCode: errorCode || 'DI_JOB_FAILED',
        lastErrorMessage: String(errorMessage || '').slice(0, 500),
      },
    },
    { returnDocument: 'after' }
  ).exec();

module.exports = {
  createJobIdempotent,
  claimNextJob,
  markJobCompleted,
  markJobRetryWait,
  markJobFailed,
};
