const ApiError = require('../../../utils/ApiError');

const SESSION_STATUSES = Object.freeze({
  CREATED: 'CREATED',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETING: 'COMPLETING',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
  FAILED: 'FAILED',
});

const TERMINAL_STATUSES = new Set([
  SESSION_STATUSES.COMPLETED,
  SESSION_STATUSES.ABANDONED,
  SESSION_STATUSES.FAILED,
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  [SESSION_STATUSES.CREATED]: [
    SESSION_STATUSES.READY,
    SESSION_STATUSES.IN_PROGRESS,
    SESSION_STATUSES.ABANDONED,
    SESSION_STATUSES.FAILED,
  ],
  // READY -> IN_PROGRESS is performed only by startSession (which records consent and the
  // opening turn). A session that has never started cannot be paused.
  [SESSION_STATUSES.READY]: [
    SESSION_STATUSES.IN_PROGRESS,
    SESSION_STATUSES.ABANDONED,
    SESSION_STATUSES.FAILED,
  ],
  [SESSION_STATUSES.IN_PROGRESS]: [
    SESSION_STATUSES.PAUSED,
    SESSION_STATUSES.COMPLETING,
    SESSION_STATUSES.COMPLETED,
    SESSION_STATUSES.ABANDONED,
    SESSION_STATUSES.FAILED,
  ],
  [SESSION_STATUSES.PAUSED]: [
    SESSION_STATUSES.IN_PROGRESS,
    SESSION_STATUSES.COMPLETING,
    SESSION_STATUSES.COMPLETED,
    SESSION_STATUSES.ABANDONED,
    SESSION_STATUSES.FAILED,
  ],
  [SESSION_STATUSES.COMPLETING]: [
    SESSION_STATUSES.COMPLETED,
    SESSION_STATUSES.FAILED,
  ],
  [SESSION_STATUSES.COMPLETED]: [],
  [SESSION_STATUSES.ABANDONED]: [],
  [SESSION_STATUSES.FAILED]: [],
});

const isTerminalStatus = (status) => TERMINAL_STATUSES.has(status);

const canTransitionSession = (fromStatus, toStatus) => {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
};

const assertSessionTransition = (fromStatus, toStatus) => {
  if (!canTransitionSession(fromStatus, toStatus)) {
    throw new ApiError(
      409,
      `Invalid interview session transition from '${fromStatus}' to '${toStatus}'`
    );
  }
};

const hasRequiredConsent = (session) =>
  !session || session.consentRequired !== true || session.consentGranted === true;

/**
 * A session accepts candidate turns only while IN_PROGRESS and, when consent is required,
 * only after consent was recorded. `session` is optional for status-only checks.
 */
const canAcceptTurn = (status, session = null) =>
  status === SESSION_STATUSES.IN_PROGRESS && hasRequiredConsent(session);

module.exports = {
  SESSION_STATUSES,
  TERMINAL_STATUSES,
  ALLOWED_TRANSITIONS,
  isTerminalStatus,
  canTransitionSession,
  assertSessionTransition,
  canAcceptTurn,
  hasRequiredConsent,
};
