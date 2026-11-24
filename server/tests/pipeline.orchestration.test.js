/**
 * Regression tests for the background job pipeline (Modules 3, 4, 6, 7 queues):
 * lease fencing, attempt-capped reclaim, exhausted-lease recovery, lease renewal,
 * requeue of FAILED jobs on explicit request, resilient polling worker, and the
 * Module 5 -> 6 evaluation outbox sweep.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

const { CandidateAnalysisJob } = require('../modules/candidate-intelligence/jobs/analysisJob.model');
const analysisJobRepo = require('../modules/candidate-intelligence/jobs/analysis-job.repository');
const { LeasePollingWorker } = require('../modules/common/jobs/polling-worker');
const InterviewEvent = require('../modules/interview-orchestrator/events/interviewEvent.model');
const { InterviewEvaluationRun } = require('../modules/interview-evaluation/models/interviewEvaluationRun.model');
const { InterviewEvaluationJob } = require('../modules/interview-evaluation/models/interviewEvaluationJob.model');
const { reconcileCompletedSessions } = require('../modules/interview-evaluation/jobs/evaluation.worker');
const { createEvaluationRunAndJob } = require('../modules/interview-evaluation/interview-evaluation.service');

let replSet;
const oid = () => new mongoose.Types.ObjectId();

const makeAnalysisJob = (overrides = {}) =>
  CandidateAnalysisJob.create({
    intakeId: oid(),
    candidateProfileId: oid(),
    userId: 'user_pipeline',
    resumeExtractionId: oid(),
    jobDescriptionExtractionId: oid(),
    idempotencyKey: `key-${new mongoose.Types.ObjectId()}`,
    status: 'QUEUED',
    maximumAttempts: 3,
    nextAttemptAt: new Date(Date.now() - 1000),
    ...overrides,
  });

const expireLease = (id) =>
  CandidateAnalysisJob.updateOne({ _id: id }, { $set: { leaseExpiresAt: new Date(Date.now() - 1000) } });

const waitFor = async (predicate, timeoutMs = 5000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
};

describe('Background job pipeline orchestration', () => {
  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  });

  it('a worker whose lease was taken over cannot overwrite the new owner (fencing)', async () => {
    await makeAnalysisJob();
    const stale = await analysisJobRepo.claimNextJob({ workerId: 'w-stale', leaseMs: 60000 });
    await expireLease(stale._id);
    const owner = await analysisJobRepo.claimNextJob({ workerId: 'w-owner', leaseMs: 60000 });
    assert.strictEqual(String(owner._id), String(stale._id));

    // Stale worker finishes late: its write must be ignored
    const staleWrite = await analysisJobRepo.markJobFailed(stale, { errorCode: 'STALE', errorMessage: 'late' });
    assert.strictEqual(staleWrite, null);
    let doc = await CandidateAnalysisJob.findById(owner._id).lean();
    assert.strictEqual(doc.status, 'PROCESSING');
    assert.strictEqual(doc.lockedBy, 'w-owner');

    // Current owner's write is applied
    const ownerWrite = await analysisJobRepo.markJobCompleted(owner, { analysisId: oid() });
    assert.ok(ownerWrite);
    doc = await CandidateAnalysisJob.findById(owner._id).lean();
    assert.strictEqual(doc.status, 'COMPLETED');
  });

  it('expired leases are not re-claimed past maximumAttempts and are failed by recovery', async () => {
    const job = await makeAnalysisJob({
      status: 'PROCESSING',
      attemptCount: 3,
      lockedBy: 'w-crashed',
      lockedAt: new Date(Date.now() - 60000),
      leaseExpiresAt: new Date(Date.now() - 1000),
    });

    const claimed = await analysisJobRepo.claimNextJob({ workerId: 'w-next', leaseMs: 60000 });
    assert.strictEqual(claimed, null, 'exhausted job must not be re-claimed');

    const failed = await analysisJobRepo.recoverExpiredLeases();
    assert.strictEqual(failed, 1);
    const doc = await CandidateAnalysisJob.findById(job._id).lean();
    assert.strictEqual(doc.status, 'FAILED');
    assert.strictEqual(doc.lastErrorCode, 'LEASE_EXPIRED_MAX_ATTEMPTS');
  });

  it('renewJobLease extends an owned lease and reports a lost one', async () => {
    await makeAnalysisJob();
    const claimed = await analysisJobRepo.claimNextJob({ workerId: 'w-hb', leaseMs: 1000 });
    const renewed = await analysisJobRepo.renewJobLease(claimed, 60000);
    assert.ok(renewed);
    assert.ok(renewed.leaseExpiresAt.getTime() > Date.now() + 50000);

    await analysisJobRepo.markJobCompleted(claimed, { analysisId: oid() });
    const afterDone = await analysisJobRepo.renewJobLease(claimed, 60000);
    assert.strictEqual(afterDone, null);
  });

  it('createJobIdempotent re-queues a FAILED job only when explicitly requested', async () => {
    const payload = {
      intakeId: oid(),
      candidateProfileId: oid(),
      userId: 'user_pipeline',
      resumeExtractionId: oid(),
      jobDescriptionExtractionId: oid(),
      idempotencyKey: 'idem-requeue',
      status: 'QUEUED',
      maximumAttempts: 3,
      nextAttemptAt: new Date(),
    };
    const created = await analysisJobRepo.createJobIdempotent(payload);
    await CandidateAnalysisJob.updateOne(
      { _id: created._id },
      { $set: { status: 'FAILED', attemptCount: 3, lastErrorCode: 'BOOM' } }
    );

    const reconcileStyle = await analysisJobRepo.createJobIdempotent(payload);
    assert.strictEqual(reconcileStyle.status, 'FAILED', 'sweeps must not silently retry');

    const userRequest = await analysisJobRepo.createJobIdempotent(payload, { requeueFailed: true });
    assert.strictEqual(String(userRequest._id), String(created._id));
    assert.strictEqual(userRequest.status, 'QUEUED');
    assert.strictEqual(userRequest.attemptCount, 0);
    assert.strictEqual(userRequest.lastErrorCode, null);
  });

  it('polling worker survives claim failures, keeps polling and respects concurrency', async () => {
    let claims = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    let processed = 0;
    const queue = [1, 2, 3, 4, 5, 6];

    const worker = new LeasePollingWorker({
      name: 'test worker',
      workerId: 'w-test',
      concurrency: 2,
      leaseMs: 60000,
      pollIntervalMs: 20,
      claim: async () => {
        claims += 1;
        if (claims <= 2) throw new Error('MongoServerSelectionError: simulated outage');
        return queue.length ? { _id: queue.shift() } : null;
      },
      process: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 30));
        inFlight -= 1;
        processed += 1;
      },
    });

    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      await worker.start();
      // Fire extra concurrent ticks to try to break the concurrency limit
      await Promise.all([worker.tick(), worker.tick(), worker.tick()]);
      const done = await waitFor(async () => processed === 6, 8000);
      assert.ok(done, `expected 6 jobs processed, got ${processed}`);
    } finally {
      await worker.stop();
      process.off('unhandledRejection', onUnhandled);
    }
    assert.ok(claims > 2, 'worker kept polling after claim failures');
    assert.ok(maxInFlight <= 2, `concurrency exceeded: ${maxInFlight}`);
    assert.strictEqual(unhandled.length, 0, 'no unhandled rejections');
  });

  it('outbox sweep closes events for sessions that can never be evaluated', async () => {
    const evt = await InterviewEvent.create({
      eventId: `evt-${oid()}`,
      sessionId: oid(), // no such session
      intakeId: oid(),
      eventType: 'INTERVIEW_SESSION_COMPLETED',
      outboxStatus: 'PENDING_DISPATCH',
    });

    await reconcileCompletedSessions();
    const doc = await InterviewEvent.findById(evt._id).lean();
    assert.strictEqual(doc.outboxStatus, 'FAILED');
  });

  it('an evaluation run left without a job (crash between the two writes) gets its job recreated', async () => {
    const sessionId = oid();
    // Raw inserts: only the fields the service reads are needed.
    await mongoose.connection.collection('interview_sessions').insertOne({
      _id: sessionId,
      sessionId: `sess-${sessionId}`,
      userId: 'user_pipeline',
      status: 'COMPLETED',
    });
    const runId = oid();
    await InterviewEvaluationRun.collection.insertOne({
      _id: runId,
      sessionId,
      evaluationVersion: 1,
      idempotencyKey: 'eval-idem-orphan',
      status: 'QUEUED',
    });

    const { job, deduplicated } = await createEvaluationRunAndJob({
      sessionIdOrUuid: sessionId,
      bypassOwnership: true,
    });
    assert.strictEqual(deduplicated, true);
    assert.ok(job, 'missing job must be recreated');
    assert.strictEqual(String(job.evaluationRunId), String(runId));
    assert.strictEqual(await InterviewEvaluationJob.countDocuments({ evaluationRunId: runId }), 1);
  });
});
