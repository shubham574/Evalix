const os = require('os');
const env = require('../../../config/env');
const blueprintJobRepo = require('./blueprint-job.repository');
const { processBlueprintJob, reconcilePendingBlueprints } = require('../planner/blueprint-orchestrator');
const { LeasePollingWorker } = require('../../common/jobs/polling-worker');

class BlueprintWorker extends LeasePollingWorker {
  constructor({
    workerId = `bp-worker-${os.hostname()}-${process.pid}`,
    concurrency = env.INTERVIEW_BLUEPRINT_WORKER_CONCURRENCY,
    leaseMs = env.INTERVIEW_BLUEPRINT_JOB_LEASE_MS,
    pollIntervalMs = 2000,
    llmProvider = null,
  } = {}) {
    super({
      name: 'Interview blueprint worker',
      workerId,
      concurrency,
      leaseMs,
      pollIntervalMs,
      enabled: env.INTERVIEW_BLUEPRINT_ENABLED,
      claim: (args) => blueprintJobRepo.claimNextJob(args),
      process: (job) => processBlueprintJob(job, { llmProvider: this.llmProvider }),
      renew: (job, ms) => blueprintJobRepo.renewJobLease(job, ms),
      recover: () => blueprintJobRepo.recoverExpiredLeases(),
      onStart: () => reconcilePendingBlueprints(),
    });
    this.llmProvider = llmProvider;
  }
}

module.exports = { BlueprintWorker };
