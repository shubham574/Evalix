const crypto = require('crypto');
const env = require('../../../config/env');
const { intakeEventBus, INTAKE_EVENTS } = require('../../common/events/intakeEvents');
const jobRepo = require('../jobs/extraction-job.repository');
const {
  enqueueIntakeIntelligence,
  reconcilePendingIntakes,
  processExtractionJob,
} = require('../extraction/extraction-orchestrator');

/**
 * MongoDB-backed background extraction worker supporting:
 * - Fast event-driven trigger via intakeEventBus
 * - Startup reconciliation & periodic sweep for lost-event recovery
 * - Atomic lease-based job claiming across multiple workers
 * - Bounded concurrency & graceful shutdown
 */
class ExtractionWorker {
  constructor({
    workerId = `worker-${process.pid}-${crypto.randomUUID().slice(0, 6)}`,
    concurrency = env.DOCUMENT_EXTRACTION_WORKER_CONCURRENCY,
    leaseMs = env.DOCUMENT_EXTRACTION_JOB_LEASE_MS,
    pollIntervalMs = 3000,
    reconcileIntervalMs = 30000,
    llmProvider = undefined,
  } = {}) {
    this.workerId = workerId;
    this.concurrency = concurrency;
    this.leaseMs = leaseMs;
    this.pollIntervalMs = pollIntervalMs;
    this.reconcileIntervalMs = reconcileIntervalMs;
    this.llmProvider = llmProvider;

    this.running = false;
    this.activeCount = 0;
    this.pollTimer = null;
    this.reconcileTimer = null;
    this._onIntakeSubmitted = null;
  }

  async start() {
    if (this.running || !env.DOCUMENT_EXTRACTION_ENABLED) return;
    this.running = true;

    this._onIntakeSubmitted = async (payload) => {
      try {
        await enqueueIntakeIntelligence(payload.intakeId);
        void this.tick();
      } catch (err) {
        console.warn('Event-triggered enqueue error:', err.code || err.message);
      }
    };
    intakeEventBus.on(INTAKE_EVENTS.INTERVIEW_INTAKE_SUBMITTED, this._onIntakeSubmitted);

    // Reconcile any READY_FOR_ANALYSIS intakes missed during downtime
    await reconcilePendingIntakes().catch((err) =>
      console.warn('Startup intake reconciliation error:', err.message)
    );

    this.pollTimer = setInterval(() => void this.tick(), this.pollIntervalMs);
    this.reconcileTimer = setInterval(
      () => void reconcilePendingIntakes().catch(() => {}),
      this.reconcileIntervalMs
    );

    void this.tick();
  }

  async tick() {
    if (!this.running) return;

    while (this.running && this.activeCount < this.concurrency) {
      const job = await jobRepo.claimNextJob({
        workerId: this.workerId,
        leaseMs: this.leaseMs,
      });

      if (!job) break;

      this.activeCount += 1;
      processExtractionJob(job, {
        llmProvider: this.llmProvider,
        workerId: this.workerId,
      })
        .catch((err) => {
          console.error('Unexpected worker job error:', err.message);
        })
        .finally(() => {
          this.activeCount = Math.max(0, this.activeCount - 1);
          if (this.running) void this.tick();
        });
    }
  }

  async stop() {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer);
      this.reconcileTimer = null;
    }
    if (this._onIntakeSubmitted) {
      intakeEventBus.off(INTAKE_EVENTS.INTERVIEW_INTAKE_SUBMITTED, this._onIntakeSubmitted);
      this._onIntakeSubmitted = null;
    }
  }
}

module.exports = { ExtractionWorker };
