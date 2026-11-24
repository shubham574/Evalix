const os = require('os');
const env = require('../../../config/env');
const analysisJobRepo = require('./analysis-job.repository');
const { processAnalysisJob, reconcilePendingAnalyses } = require('../analysis/analysis-orchestrator');
const { LeasePollingWorker } = require('../../common/jobs/polling-worker');

class AnalysisWorker extends LeasePollingWorker {
  constructor({
    workerId = `ci-worker-${os.hostname()}-${process.pid}`,
    concurrency = env.CANDIDATE_INTELLIGENCE_WORKER_CONCURRENCY,
    leaseMs = env.CANDIDATE_INTELLIGENCE_JOB_LEASE_MS,
    pollIntervalMs = 2000,
    llmProvider = null,
  } = {}) {
    super({
      name: 'Candidate analysis worker',
      workerId,
      concurrency,
      leaseMs,
      pollIntervalMs,
      enabled: env.CANDIDATE_INTELLIGENCE_ENABLED,
      claim: (args) => analysisJobRepo.claimNextJob(args),
      process: (job) => processAnalysisJob(job, { llmProvider: this.llmProvider }),
      renew: (job, ms) => analysisJobRepo.renewJobLease(job, ms),
      recover: () => analysisJobRepo.recoverExpiredLeases(),
      onStart: () => reconcilePendingAnalyses(),
    });
    this.llmProvider = llmProvider;
  }
}

module.exports = { AnalysisWorker };
