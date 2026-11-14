const os = require('os');
const env = require('../../../config/env');
const analysisJobRepo = require('./analysis-job.repository');
const { processAnalysisJob, reconcilePendingAnalyses } = require('../analysis/analysis-orchestrator');

class AnalysisWorker {
  constructor({
    workerId = `ci-worker-${os.hostname()}-${process.pid}`,
    concurrency = env.CANDIDATE_INTELLIGENCE_WORKER_CONCURRENCY,
    leaseMs = env.CANDIDATE_INTELLIGENCE_JOB_LEASE_MS,
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
    if (!env.CANDIDATE_INTELLIGENCE_ENABLED || this.running) return;
    this.running = true;

    try {
      await reconcilePendingAnalyses();
    } catch (err) {
      console.error('Candidate intelligence startup reconciliation failed:', err.message);
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
      const job = await analysisJobRepo.claimNextJob({
        workerId: this.workerId,
        leaseMs: this.leaseMs,
      });

      if (!job) break;

      this.activeCount += 1;
      void processAnalysisJob(job, { llmProvider: this.llmProvider })
        .catch((err) => {
          console.error('Candidate analysis worker job failure:', err.message);
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

module.exports = { AnalysisWorker };
