const { createJobStateMachine } = require('../../../utils/jobStateMachine');
const { JOB_STATUSES, TERMINAL_NON_RETRYABLE } = require('../jobs/extractionJob.model');

const EXTRACTION_TRANSITIONS = Object.freeze({
  QUEUED: ['PROCESSING'],
  PROCESSING: [
    'COMPLETED',
    'RETRY_WAIT',
    'FAILED',
    'NEEDS_OCR',
    'BLOCKED_SECURITY_SCAN',
    'REJECTED',
  ],
  RETRY_WAIT: ['PROCESSING'],
  // FAILED may only be re-queued via explicit manual retry (never directly to PROCESSING)
  FAILED: ['QUEUED'],
  COMPLETED: [],
  NEEDS_OCR: [],
  BLOCKED_SECURITY_SCAN: [],
  REJECTED: [],
});

const EXTRACTION_TERMINAL_STATES = Object.freeze([...TERMINAL_NON_RETRYABLE]);

// Sanity check against model enum at module load
for (const status of JOB_STATUSES) {
  if (!Object.prototype.hasOwnProperty.call(EXTRACTION_TRANSITIONS, status)) {
    throw new Error(`ExtractionStateMachine missing model status '${status}'`);
  }
}

const extractionStateMachine = createJobStateMachine({
  name: 'DocumentExtractionJob',
  transitions: EXTRACTION_TRANSITIONS,
  terminalStates: EXTRACTION_TERMINAL_STATES,
  securityBlockedStates: ['BLOCKED_SECURITY_SCAN'],
});

const canManualRetry = (status) =>
  status === 'FAILED' && extractionStateMachine.canTransition('FAILED', 'QUEUED');

module.exports = {
  EXTRACTION_TRANSITIONS,
  EXTRACTION_TERMINAL_STATES,
  extractionStateMachine,
  canManualRetry,
};
