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
    heartbeatIntervalMs = undefined,
    pollIntervalMs = 3000,
    reconcileIntervalMs = 30000,
    llmProvider = undefined,
  } = {}) {
    this.workerId = workerId;
    this.concurrency = concurrency;
    this.leaseMs = leaseMs;
    this.heartbeatIntervalMs =
      heartbeatIntervalMs !== undefined
        ? heartbeatIntervalMs
        : Math.max(25, Math.min(env.DOCUMENT_EXTRACTION_HEARTBEAT_INTERVAL_MS, Math.floor(leaseMs / 3)));
    this.pollIntervalMs = pollIntervalMs;
    this.reconcileIntervalMs = reconcileIntervalMs;
    this.llmProvider = llmProvider;

    this.running = false;
    this.activeCount = 0;
    this.pollTimer = null;
    this.reconcileTimer = null;
    this._onIntakeSubmitted = null;
    this.activeHeartbeats = new Map();
    this._ticking = false;
    this._tickRequested = false;
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

    // Reconcile any READY_FOR_ANALYSIS intakes missed during downtime & recover exhausted expired leases
    await reconcilePendingIntakes().catch((err) =>
      console.warn('Startup intake reconciliation error:', err.message)
    );
    await jobRepo.recoverExpiredLeases().catch((err) =>
      console.warn('Startup lease recovery error:', err.message)
    );

    this.pollTimer = setInterval(() => void this.tick(), this.pollIntervalMs);
    this.reconcileTimer = setInterval(() => {
      void reconcilePendingIntakes().catch(() => {});
      void jobRepo.recoverExpiredLeases().catch(() => {});
    }, this.reconcileIntervalMs);

    void this.tick();
  }

  _startJobHeartbeat(job) {
    const jobKey = String(job._id);
    const controller = new AbortController();
    const state = {
      timer: null,
      inFlight: false,
      leaseLost: false,
      stopped: false,
      controller,
      renewalCount: 0,
    };

    const stop = () => {
      if (state.stopped) return;
      state.stopped = true;
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }
      this.activeHeartbeats.delete(jobKey);
    };

    const beat = async () => {
      if (state.stopped || state.inFlight || state.leaseLost || !this.running) return;
      state.inFlight = true;
      try {
        const renewed = await jobRepo.renewJobLease(job._id, {
          workerId: this.workerId,
          leaseToken: job.leaseToken,
          leaseMs: this.leaseMs,
        });
        if (!renewed) {
          state.leaseLost = true;
          stop();
          controller.abort(new Error('LEASE_LOST'));
        } else {
          state.renewalCount += 1;
        }
      } catch (_) {
        // Transient DB error: do not overlap; next beat will retry before expiry
      } finally {
        state.inFlight = false;
      }
    };

    state.timer = setInterval(() => void beat(), this.heartbeatIntervalMs);
    if (typeof state.timer.unref === 'function') state.timer.unref();
    this.activeHeartbeats.set(jobKey, { state, stop });

    return {
      signal: controller.signal,
      isLeaseLost: () => state.leaseLost,
      stop,
    };
  }

  async tick() {
    if (!this.running) return;
    // tick() is triggered by the poll interval, intake events and every finished job. Running
    // several claim loops at once let them all pass the concurrency check before any of them
    // incremented activeCount, over-claiming jobs. Serialize: remember the request and re-run.
    if (this._ticking) {
      this._tickRequested = true;
      return;
    }
    this._ticking = true;
    try {
      do {
        this._tickRequested = false;
        await this._claimAvailable();
      } while (this._tickRequested && this.running);
    } catch (err) {
      // A failed claim (e.g. MongoDB unavailable) must not become an unhandled rejection;
      // the poll interval retries.
      console.error('Extraction worker claim failed:', err.message);
    } finally {
      this._ticking = false;
    }
  }

  async _claimAvailable() {
    while (this.running && this.activeCount < this.concurrency) {
      const job = await jobRepo.claimNextJob({
        workerId: this.workerId,
        leaseMs: this.leaseMs,
      });

      if (!job) break;

      this.activeCount += 1;
      const hb = this._startJobHeartbeat(job);

      processExtractionJob(job, {
        llmProvider: this.llmProvider,
        workerId: this.workerId,
        signal: hb.signal,
        isLeaseLost: hb.isLeaseLost,
      })
        .catch((err) => {
          console.error('Unexpected worker job error:', err.message);
        })
        .finally(() => {
          hb.stop();
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
    for (const entry of [...this.activeHeartbeats.values()]) {
      entry.stop();
      entry.state.controller.abort(new Error('WORKER_STOPPED'));
    }
    this.activeHeartbeats.clear();
    if (this._onIntakeSubmitted) {
      intakeEventBus.off(INTAKE_EVENTS.INTERVIEW_INTAKE_SUBMITTED, this._onIntakeSubmitted);
      this._onIntakeSubmitted = null;
    }
  }
}

module.exports = { ExtractionWorker };
