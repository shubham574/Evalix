const { InterviewEvaluationJob } = require('../models/interviewEvaluationJob.model');
const lease = require('../../common/jobs/lease');

const createJobIdempotent = async (payload, options = {}) =>
  lease.createJobIdempotent(InterviewEvaluationJob, payload, {
    ...options,
    resetSet: { failureStage: null },
  });

const claimNextJob = async ({ workerId, leaseMs }) => {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  return InterviewEvaluationJob.findOneAndUpdate(
    lease.claimableFilter(now),
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
  InterviewEvaluationJob.findOneAndUpdate(
    lease.fenceFilter(jobId),
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
  InterviewEvaluationJob.findOneAndUpdate(
    lease.fenceFilter(jobId),
    {
      $set: {
        status: 'RETRY_WAIT',
        nextAttemptAt,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        failureStage: failureStage || 'QUESTION_EVALUATION',
        lastErrorCode: errorCode || 'TRANSIENT_ERROR',
        lastErrorMessage: String(errorMessage || '').slice(0, 500),
      },
    },
    { returnDocument: 'after' }
  ).exec();

const markJobFailed = async (jobId, { failureStage, errorCode, errorMessage }) =>
  InterviewEvaluationJob.findOneAndUpdate(
    lease.fenceFilter(jobId),
    {
      $set: {
        status: 'FAILED',
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        failureStage: failureStage || 'QUESTION_EVALUATION',
        lastErrorCode: errorCode || 'EVALUATION_FAILED',
        lastErrorMessage: String(errorMessage || '').slice(0, 500),
      },
    },
    { returnDocument: 'after' }
  ).exec();

/** Extend the lease of a job this worker still owns; null when the lease was lost. */
const renewJobLease = (job, leaseMs) => lease.renewLease(InterviewEvaluationJob, job, leaseMs);

/** Fail PROCESSING jobs whose lease expired on their final attempt. */
const recoverExpiredLeases = () => lease.failExhaustedExpiredLeases(InterviewEvaluationJob);

module.exports = {
  createJobIdempotent,
  claimNextJob,
  markJobCompleted,
  markJobRetryWait,
  markJobFailed,
  renewJobLease,
  recoverExpiredLeases,
};
