const { BlueprintJob } = require('./blueprintJob.model');

const createJobIdempotent = async (payload) =>
  BlueprintJob.findOneAndUpdate(
    { idempotencyKey: payload.idempotencyKey },
    { $setOnInsert: payload },
    { upsert: true, new: true }
  ).lean();

const findLatestJobByIntakeAndUser = async (intakeId, userId) =>
  BlueprintJob.findOne({ intakeId, userId }).sort({ createdAt: -1 }).lean();

const claimNextJob = async ({ workerId, leaseMs }) => {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  return BlueprintJob.findOneAndUpdate(
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
      new: true,
    }
  ).exec();
};

const markJobCompleted = async (jobId, { blueprintId }) =>
  BlueprintJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: 'COMPLETED',
        blueprintId,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        failureStage: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    },
    { new: true }
  ).exec();

const markJobRetryWait = async (jobId, { nextAttemptAt, failureStage, errorCode, errorMessage }) =>
  BlueprintJob.findByIdAndUpdate(
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
        lastErrorMessage: (errorMessage || '').slice(0, 500),
      },
    },
    { new: true }
  ).exec();

const markJobFailed = async (jobId, { failureStage, errorCode, errorMessage }) =>
  BlueprintJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: 'FAILED',
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        failureStage: failureStage || 'GENERATION',
        lastErrorCode: errorCode || 'BLUEPRINT_FAILED',
        lastErrorMessage: (errorMessage || '').slice(0, 500),
      },
    },
    { new: true }
  ).exec();

module.exports = {
  createJobIdempotent,
  findLatestJobByIntakeAndUser,
  claimNextJob,
  markJobCompleted,
  markJobRetryWait,
  markJobFailed,
};
