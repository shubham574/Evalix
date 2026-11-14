const os = require('os');
const env = require('../../../config/env');
const blueprintJobRepo = require('./blueprint-job.repository');
const { processBlueprintJob, reconcilePendingBlueprints } = require('../planner/blueprint-orchestrator');

class BlueprintWorker {
  constructor({
    workerId = `bp-worker-${os.hostname()}-${process.pid}`,
    concurrency = env.INTERVIEW_BLUEPRINT_WORKER_CONCURRENCY,
    leaseMs = env.INTERVIEW_BLUEPRINT_JOB_LEASE_MS,
    pollIntervalMs = 2000,
    llmProvider = null,
  } = {}) {
    this.workerId = workerId;
    this.concurrency = concurrency;
    this.leaseMs = leaseMs;
    this.pollIntervalMs = pollIntervalMs;
    this.llmProvider = llmProvider;
    this.running = false;
    this.activeCount = 0;
    this.timer = null;
  }

  async start() {
    if (!env.INTERVIEW_BLUEPRINT_ENABLED || this.running) return;
    this.running = true;

    try {
      await reconcilePendingBlueprints();
    } catch (err) {
      console.error('Interview blueprint startup reconciliation failed:', err.message);
    }

    this.scheduleNextTick(50);
  }

  scheduleNextTick(delayMs = this.pollIntervalMs) {
    if (!this.running) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  async tick() {
    if (!this.running) return;

    while (this.running && this.activeCount < this.concurrency) {
      const job = await blueprintJobRepo.claimNextJob({
        workerId: this.workerId,
        leaseMs: this.leaseMs,
      });

      if (!job) break;

      this.activeCount += 1;
      void processBlueprintJob(job, { llmProvider: this.llmProvider })
        .catch((err) => {
          console.error('Blueprint worker job error:', err.message);
        })
        .finally(() => {
          this.activeCount -= 1;
          if (this.running) this.scheduleNextTick(10);
        });
    }

    if (this.running) {
      this.scheduleNextTick(this.pollIntervalMs);
    }
  }

  async stop() {
    this.running = false;
    clearTimeout(this.timer);
    while (this.activeCount > 0) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}

module.exports = { BlueprintWorker };
