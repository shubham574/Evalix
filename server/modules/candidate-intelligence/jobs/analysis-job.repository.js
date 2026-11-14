const { CandidateAnalysisJob } = require('./analysisJob.model');

const createJobIdempotent = async (jobPayload) => {
  const result = await CandidateAnalysisJob.findOneAndUpdate(
    { idempotencyKey: jobPayload.idempotencyKey },
    { $setOnInsert: jobPayload },
    { upsert: true, new: true }
  ).lean();
  return result;
};

const findLatestJobByIntakeAndUser = async (intakeId, userId) =>
  CandidateAnalysisJob.findOne({ intakeId, userId }).sort({ createdAt: -1 }).lean();

const claimNextJob = async ({ workerId, leaseMs }) => {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  return CandidateAnalysisJob.findOneAndUpdate(
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

const markJobCompleted = async (jobId, { analysisId }) =>
  CandidateAnalysisJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: 'COMPLETED',
        analysisId,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    },
    { new: true }
  ).exec();

const markJobRetryWait = async (jobId, { nextAttemptAt, errorCode, errorMessage }) =>
  CandidateAnalysisJob.findByIdAndUpdate(
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

const markJobFailed = async (jobId, { errorCode, errorMessage }) =>
  CandidateAnalysisJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: 'FAILED',
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: errorCode || 'ANALYSIS_FAILED',
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
