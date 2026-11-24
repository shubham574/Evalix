const crypto = require('crypto');
const { DocumentExtractionJob } = require('./extractionJob.model');
const { extractionStateMachine } = require('../extraction/extraction-state-machine');

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
      returnDocument: 'after',
      ...(session ? { session } : {}),
    }
  ).exec();
};

/**
 * Atomically claim the next eligible job (QUEUED, RETRY_WAIT due now, or expired PROCESSING lease
 * with remaining attempts). Generates a unique leaseToken for stale-worker fencing.
 */
const claimNextJob = async ({ workerId, leaseMs, documentType = null }) => {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);
  const leaseToken = crypto.randomUUID();

  const query = {
    $or: [
      { status: 'QUEUED', nextAttemptAt: { $lte: now } },
      { status: 'RETRY_WAIT', nextAttemptAt: { $lte: now } },
      {
        status: 'PROCESSING',
        leaseExpiresAt: { $lte: now },
        $expr: { $lt: ['$attemptCount', '$maximumAttempts'] },
      },
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
        leaseToken,
      },
      $inc: { attemptCount: 1, stateVersion: 1 },
    },
    {
      sort: { nextAttemptAt: 1, createdAt: 1, _id: 1 },
      returnDocument: 'after',
    }
  ).exec();
};

/**
 * Safely extend an active worker's lease, fenced by status, workerId, leaseToken,
 * and non-expired leaseExpiresAt (cannot revive an already expired lease).
 */
const renewJobLease = async (jobId, { workerId, leaseToken, leaseMs, now = new Date() }) => {
  if (!leaseToken || !workerId) return null;
  const currentNow = now instanceof Date ? now : new Date(now);
  const leaseExpiresAt = new Date(currentNow.getTime() + leaseMs);
  return DocumentExtractionJob.findOneAndUpdate(
    {
      _id: jobId,
      status: 'PROCESSING',
      lockedBy: workerId,
      leaseToken,
      leaseExpiresAt: { $gt: currentNow },
    },
    {
      $set: { leaseExpiresAt },
    },
    { returnDocument: 'after' }
  ).exec();
};

/**
 * Recover expired PROCESSING jobs that have exhausted maximumAttempts by transitioning
 * them atomically to FAILED, fenced by their current leaseToken.
 */
const recoverExpiredLeases = async ({ now = new Date(), limit = 50 } = {}) => {
  const expiredExhausted = await DocumentExtractionJob.find({
    status: 'PROCESSING',
    leaseExpiresAt: { $lte: now },
    $expr: { $gte: ['$attemptCount', '$maximumAttempts'] },
  })
    .select('_id leaseToken')
    .limit(limit)
    .lean();

  let recoveredCount = 0;
  for (const candidate of expiredExhausted) {
    extractionStateMachine.assertTransition('PROCESSING', 'FAILED');
    const updated = await DocumentExtractionJob.findOneAndUpdate(
      {
        _id: candidate._id,
        status: 'PROCESSING',
        leaseExpiresAt: { $lte: now },
        leaseToken: candidate.leaseToken ?? null,
      },
      {
        $set: {
          status: 'FAILED',
          lockedBy: null,
          lockedAt: null,
          leaseExpiresAt: null,
          leaseToken: null,
          lastRecoveredAt: now,
          lastErrorCode: 'LEASE_EXPIRED_MAX_ATTEMPTS',
          lastErrorMessage: 'Worker lease expired after exhausting maximum attempts',
        },
        $inc: { stateVersion: 1, recoveryCount: 1 },
      },
      { returnDocument: 'after' }
    ).exec();
    if (updated) recoveredCount += 1;
  }

  return recoveredCount;
};

const markJobCompleted = async (jobId, { extractionId, leaseToken = null }) => {
  extractionStateMachine.assertTransition('PROCESSING', 'COMPLETED');
  const filter = {
    _id: jobId,
    status: 'PROCESSING',
    ...(leaseToken ? { leaseToken } : {}),
  };

  return DocumentExtractionJob.findOneAndUpdate(
    filter,
    {
      $set: {
        status: 'COMPLETED',
        extractionId,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        leaseToken: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      $inc: { stateVersion: 1 },
    },
    { returnDocument: 'after' }
  ).exec();
};

const markJobTerminal = async (jobId, { status, errorCode, errorMessage, leaseToken = null }) => {
  extractionStateMachine.assertTransition('PROCESSING', status);
  const filter = {
    _id: jobId,
    status: 'PROCESSING',
    ...(leaseToken ? { leaseToken } : {}),
  };

  return DocumentExtractionJob.findOneAndUpdate(
    filter,
    {
      $set: {
        status,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        leaseToken: null,
        lastErrorCode: errorCode || status,
        lastErrorMessage: (errorMessage || '').slice(0, 500),
      },
      $inc: { stateVersion: 1 },
    },
    { returnDocument: 'after' }
  ).exec();
};

const markJobRetryWait = async (jobId, { nextAttemptAt, errorCode, errorMessage, leaseToken = null }) => {
  extractionStateMachine.assertTransition('PROCESSING', 'RETRY_WAIT');
  const filter = {
    _id: jobId,
    status: 'PROCESSING',
    ...(leaseToken ? { leaseToken } : {}),
  };

  return DocumentExtractionJob.findOneAndUpdate(
    filter,
    {
      $set: {
        status: 'RETRY_WAIT',
        nextAttemptAt,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        leaseToken: null,
        lastErrorCode: errorCode || 'TRANSIENT_ERROR',
        lastErrorMessage: (errorMessage || '').slice(0, 500),
      },
      $inc: { stateVersion: 1 },
    },
    { returnDocument: 'after' }
  ).exec();
};

const listJobsByRunId = async (runId) =>
  DocumentExtractionJob.find({ runId }).sort({ createdAt: 1 }).lean();

const requeueFailedJob = async (jobId, userId, reason) => {
  extractionStateMachine.assertTransition('FAILED', 'QUEUED');
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
        leaseToken: null,
        lastManualRetryAt: now,
      },
      $inc: { maximumAttempts: 1, stateVersion: 1 },
      $push: {
        retryHistory: {
          retriedAt: now,
          reason: reason || 'Manual retry requested',
          triggeredBy: userId,
        },
      },
    },
    { returnDocument: 'after' }
  ).exec();
};

module.exports = {
  createJobIdempotent,
  claimNextJob,
  renewJobLease,
  recoverExpiredLeases,
  markJobCompleted,
  markJobTerminal,
  markJobRetryWait,
  listJobsByRunId,
  requeueFailedJob,
};
