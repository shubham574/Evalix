/**
 * Shared lease helpers for MongoDB-backed job queues (Modules 3, 4, 6, 7).
 *
 * A claimed job is owned by the pair (lockedBy, lockedAt) written atomically at claim time.
 * That pair is the fencing token: every state transition after claim is applied only while the
 * job is still PROCESSING under the same token, so a worker whose lease expired (and whose job
 * was re-claimed by another worker) cannot overwrite the new owner's result.
 */

/**
 * Filter selecting jobs that may be claimed now. Expired PROCESSING leases are only re-claimed
 * while attempts remain, so a job that crashes its worker cannot be re-claimed forever.
 * @param {Date} now
 */
const claimableFilter = (now) => ({
  $or: [
    { status: 'QUEUED', nextAttemptAt: { $lte: now } },
    { status: 'RETRY_WAIT', nextAttemptAt: { $lte: now } },
    {
      status: 'PROCESSING',
      leaseExpiresAt: { $lte: now },
      $expr: { $lt: ['$attemptCount', '$maximumAttempts'] },
    },
  ],
});

/**
 * Build the update filter for a post-claim transition.
 * Accepts a claimed job document (fenced) or a bare id (unfenced, legacy callers).
 * @param {object|string} jobOrId
 */
const fenceFilter = (jobOrId) => {
  if (jobOrId && typeof jobOrId === 'object' && jobOrId._id && jobOrId.lockedBy) {
    return {
      _id: jobOrId._id,
      status: 'PROCESSING',
      lockedBy: jobOrId.lockedBy,
      lockedAt: jobOrId.lockedAt,
    };
  }
  return { _id: jobOrId && jobOrId._id ? jobOrId._id : jobOrId };
};

/**
 * Extend the lease of a job this worker still owns. Returns the updated job, or null when the
 * lease was lost (job completed, failed, or re-claimed by another worker).
 * @param {import('mongoose').Model} Model
 * @param {object} job claimed job document
 * @param {number} leaseMs
 */
const renewLease = (Model, job, leaseMs) =>
  Model.findOneAndUpdate(
    fenceFilter(job),
    { $set: { leaseExpiresAt: new Date(Date.now() + leaseMs) } },
    { returnDocument: 'after' }
  ).exec();

/**
 * Fail PROCESSING jobs whose lease expired after their last allowed attempt (e.g. the worker
 * process crashed mid-job on the final attempt). Without this they would stay PROCESSING forever.
 * @param {import('mongoose').Model} Model
 * @param {{ errorCode?: string, extraSet?: object }} [options]
 * @returns {Promise<number>} number of jobs failed
 */
const failExhaustedExpiredLeases = async (Model, { errorCode = 'LEASE_EXPIRED_MAX_ATTEMPTS', extraSet = {} } = {}) => {
  const now = new Date();
  const result = await Model.updateMany(
    {
      status: 'PROCESSING',
      leaseExpiresAt: { $lte: now },
      $expr: { $gte: ['$attemptCount', '$maximumAttempts'] },
    },
    {
      $set: {
        status: 'FAILED',
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: errorCode,
        lastErrorMessage: 'Job lease expired on its final attempt (worker stopped or crashed).',
        ...extraSet,
      },
    }
  ).exec();
  return result.modifiedCount || 0;
};

/**
 * Idempotent job creation keyed by `idempotencyKey`.
 *
 * With `requeueFailed`, a previously FAILED job for the same key is reset to QUEUED with a fresh
 * attempt budget. Without it, a user who explicitly asks again after a failure would get the
 * same dead FAILED job back forever. Reconciliation sweeps leave it off so permanent failures are
 * not retried on every restart.
 * @param {import('mongoose').Model} Model
 * @param {object} payload must include idempotencyKey
 * @param {{ requeueFailed?: boolean, resetSet?: object }} [options]
 */
const createJobIdempotent = async (Model, payload, { requeueFailed = false, resetSet = {} } = {}) => {
  const job = await Model.findOneAndUpdate(
    { idempotencyKey: payload.idempotencyKey },
    { $setOnInsert: payload },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  if (!requeueFailed || !job || job.status !== 'FAILED') return job;

  const requeued = await Model.findOneAndUpdate(
    { _id: job._id, status: 'FAILED' },
    {
      $set: {
        status: 'QUEUED',
        attemptCount: 0,
        nextAttemptAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        ...resetSet,
      },
    },
    { returnDocument: 'after' }
  ).lean();
  return requeued || job;
};

module.exports = {
  claimableFilter,
  fenceFilter,
  renewLease,
  failExhaustedExpiredLeases,
  createJobIdempotent,
};
