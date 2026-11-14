const { createStateMachine } = require('./stateMachine');

const DEFAULT_JOB_TRANSITIONS = Object.freeze({
  QUEUED: ['PROCESSING'],
  PROCESSING: ['COMPLETED', 'RETRY_WAIT', 'FAILED'],
  RETRY_WAIT: ['PROCESSING'],
  COMPLETED: [],
  FAILED: [],
});

const DEFAULT_TERMINAL_STATES = Object.freeze(['COMPLETED', 'FAILED']);

/**
 * Create a reusable background job state machine with retry-policy and lease-expiration helpers.
 * Modules may supply custom transitions, domain-specific terminal/failure states, and retry/lease defaults.
 */
const createJobStateMachine = ({
  name,
  transitions = DEFAULT_JOB_TRANSITIONS,
  terminalStates = DEFAULT_TERMINAL_STATES,
  processingState = 'PROCESSING',
  retryWaitState = 'RETRY_WAIT',
  securityBlockedStates = [],
  baseRetryDelayMs = 5000,
  defaultLeaseMs = 30000,
  defaultMaxAttempts = 3,
} = {}) => {
  const machine = createStateMachine({
    name,
    transitions,
    terminalStates,
  });

  if (!machine.hasState(processingState)) {
    throw new Error(`JobStateMachine '${name}' missing processingState '${processingState}'`);
  }

  const securityBlockedSet = new Set(securityBlockedStates);
  for (const s of securityBlockedSet) {
    if (!machine.hasState(s)) {
      throw new Error(`JobStateMachine '${name}' unknown securityBlockedState '${s}'`);
    }
  }

  const isSecurityBlocked = (status) => securityBlockedSet.has(status);

  const canRetryAutomatically = ({ attemptCount, maximumAttempts = defaultMaxAttempts, retryable = true }) =>
    Boolean(retryable) && Number(attemptCount) < Number(maximumAttempts);

  const computeRetryDelayMs = ({ attemptCount = 1, baseDelayMs = baseRetryDelayMs } = {}) =>
    Number(baseDelayMs) * Math.pow(2, Math.max(0, Number(attemptCount) - 1));

  const isLeaseExpired = (leaseExpiresAt, now = new Date()) => {
    if (!leaseExpiresAt) return false;
    return new Date(leaseExpiresAt).getTime() <= new Date(now).getTime();
  };

  const canReclaimLease = (job, now = new Date()) => {
    if (!job || machine.isTerminal(job.status)) return false;
    if (job.status !== processingState) return false;
    if (!isLeaseExpired(job.leaseExpiresAt, now)) return false;
    return Number(job.attemptCount || 0) < Number(job.maximumAttempts || defaultMaxAttempts);
  };

  return Object.freeze({
    ...machine,
    processingState,
    retryWaitState,
    defaultLeaseMs,
    defaultMaxAttempts,
    isSecurityBlocked,
    canRetryAutomatically,
    computeRetryDelayMs,
    isLeaseExpired,
    canReclaimLease,
  });
};

module.exports = {
  DEFAULT_JOB_TRANSITIONS,
  DEFAULT_TERMINAL_STATES,
  createJobStateMachine,
};
