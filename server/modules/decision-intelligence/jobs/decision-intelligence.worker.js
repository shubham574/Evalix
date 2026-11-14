const os = require('os');
const env = require('../../../config/env');
const jobRepo = require('./decision-intelligence-job.repository');
const {
  executeStudentLearningInsightsGeneration,
  executeDevelopmentPlanGeneration,
} = require('../decision-intelligence.service');

const processDecisionIntelligenceJob = async (job, { llmProvider = null } = {}) => {
  try {
    if (
      job.jobType === 'STUDENT_LEARNING_INSIGHTS' ||
      job.jobType === 'DECISION_SUPPORT_REPORT'
    ) {
      await executeStudentLearningInsightsGeneration(
        { sessionIdOrUuid: job.sessionId },
        { llmProvider }
      );
    } else if (job.jobType === 'DEVELOPMENT_PLAN') {
      await executeDevelopmentPlanGeneration(
        { sessionIdOrUuid: job.sessionId },
        { llmProvider }
      );
    }

    await jobRepo.markJobCompleted(job._id);
    return true;
  } catch (err) {
    const canRetry = job.attemptCount < job.maximumAttempts;
    if (canRetry) {
      const backoffMs =
        env.DECISION_INTELLIGENCE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, job.attemptCount - 1));
      await jobRepo.markJobRetryWait(job._id, {
        nextAttemptAt: new Date(Date.now() + backoffMs),
        failureStage: job.jobType,
        errorCode: err.code || 'DI_TRANSIENT_ERROR',
        errorMessage: err.message,
      });
    } else {
      await jobRepo.markJobFailed(job._id, {
        failureStage: job.jobType,
        errorCode: err.code || 'DI_FAILED',
        errorMessage: err.message,
      });
    }
    return false;
  }
};

class DecisionIntelligenceWorker {
  constructor({
    workerId = `di-worker-${os.hostname()}-${process.pid}`,
    concurrency = env.DECISION_INTELLIGENCE_WORKER_CONCURRENCY,
    leaseMs = env.DECISION_INTELLIGENCE_JOB_LEASE_MS,
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
    if (!env.DECISION_INTELLIGENCE_ENABLED || this.running) return;
    this.running = true;
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
      const job = await jobRepo.claimNextJob({
        workerId: this.workerId,
        leaseMs: this.leaseMs,
      });
      if (!job) break;

      this.activeCount += 1;
      void processDecisionIntelligenceJob(job, { llmProvider: this.llmProvider })
        .catch((err) => {
          console.error('DecisionIntelligenceWorker job error:', err.message);
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

module.exports = {
  DecisionIntelligenceWorker,
  processDecisionIntelligenceJob,
};
