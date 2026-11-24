const os = require('os');
const env = require('../../../config/env');
const { LeasePollingWorker } = require('../../common/jobs/polling-worker');
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

    await jobRepo.markJobCompleted(job);
    return true;
  } catch (err) {
    const canRetry = job.attemptCount < job.maximumAttempts;
    if (canRetry) {
      const backoffMs =
        env.DECISION_INTELLIGENCE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, job.attemptCount - 1));
      await jobRepo.markJobRetryWait(job, {
        nextAttemptAt: new Date(Date.now() + backoffMs),
        failureStage: job.jobType,
        errorCode: err.code || 'DI_TRANSIENT_ERROR',
        errorMessage: err.message,
      });
    } else {
      await jobRepo.markJobFailed(job, {
        failureStage: job.jobType,
        errorCode: err.code || 'DI_FAILED',
        errorMessage: err.message,
      });
    }
    return false;
  }
};

class DecisionIntelligenceWorker extends LeasePollingWorker {
  constructor({
    workerId = `di-worker-${os.hostname()}-${process.pid}`,
    concurrency = env.DECISION_INTELLIGENCE_WORKER_CONCURRENCY,
    leaseMs = env.DECISION_INTELLIGENCE_JOB_LEASE_MS,
    pollIntervalMs = 2000,
    llmProvider = null,
  } = {}) {
    super({
      name: 'Decision intelligence worker',
      workerId,
      concurrency,
      leaseMs,
      pollIntervalMs,
      enabled: env.DECISION_INTELLIGENCE_ENABLED,
      claim: (args) => jobRepo.claimNextJob(args),
      process: (job) => processDecisionIntelligenceJob(job, { llmProvider: this.llmProvider }),
      renew: (job, ms) => jobRepo.renewJobLease(job, ms),
      recover: () => jobRepo.recoverExpiredLeases(),
    });
    this.llmProvider = llmProvider;
  }
}

module.exports = {
  DecisionIntelligenceWorker,
  processDecisionIntelligenceJob,
};
