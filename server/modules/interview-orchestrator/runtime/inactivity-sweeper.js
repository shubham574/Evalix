const crypto = require('crypto');
const env = require('../../../config/env');
const { withTransaction } = require('../../common/db/transaction');
const InterviewSession = require('../session/interviewSession.model');
const InterviewEvent = require('../events/interviewEvent.model');
const {
  SESSION_STATUSES,
  canTransitionSession,
} = require('../session/session-state-machine');
const { accumulatePausedTime } = require('./time-manager');

const SWEEPABLE_STATUSES = [SESSION_STATUSES.IN_PROGRESS, SESSION_STATUSES.PAUSED];
const TERMINATION_REASON = 'INACTIVITY_TIMEOUT';

/**
 * Abandon a single stale session with the same conditional-update style the runtime uses
 * ({ _id, status, stateVersion } + lastActivityAt still stale). Returns true if this call
 * abandoned it; false if it lost a race (the candidate came back, or another sweeper won).
 */
const abandonInactiveSession = async (session, { now, cutoff }) => {
  if (!canTransitionSession(session.status, SESSION_STATUSES.ABANDONED)) return false;

  // Idle time is not active interview time, so active duration is left as of the last
  // activity. A paused session's pause interval is closed out.
  const pausedDurationSeconds =
    session.status === SESSION_STATUSES.PAUSED
      ? (() => {
          const copy = { ...session };
          accumulatePausedTime(copy, now);
          return copy.pausedDurationSeconds;
        })()
      : Number(session.pausedDurationSeconds) || 0;

  return withTransaction(async (dbSession) => {
    const updated = await InterviewSession.findOneAndUpdate(
      {
        _id: session._id,
        status: session.status,
        stateVersion: session.stateVersion,
        lastActivityAt: { $lt: cutoff },
      },
      {
        $set: {
          status: SESSION_STATUSES.ABANDONED,
          abandonedAt: now,
          terminationReason: TERMINATION_REASON,
          pausedAt: null,
          pausedDurationSeconds,
        },
        $inc: { stateVersion: 1 },
      },
      { returnDocument: 'after', session: dbSession || undefined }
    );
    if (!updated) return false;

    const evtDoc = {
      eventId: `evt_${crypto.randomUUID()}`,
      sessionId: session._id,
      intakeId: session.intakeId,
      eventType: 'SESSION_ABANDONED',
      payload: {
        reason: TERMINATION_REASON,
        previousStatus: session.status,
        lastActivityAt: session.lastActivityAt,
        abandonedAt: now,
      },
      outboxStatus: 'INTERNAL',
    };
    if (dbSession) {
      await InterviewEvent.create([evtDoc], { session: dbSession });
    } else {
      await InterviewEvent.create(evtDoc);
    }
    return true;
  });
};

/**
 * Periodically marks IN_PROGRESS / PAUSED interview sessions whose lastActivityAt is older
 * than the inactivity timeout as ABANDONED, so abandoned tabs never stay IN_PROGRESS forever.
 */
class InactivitySweeper {
  constructor({
    intervalMs = 60 * 1000,
    inactivityTimeoutMs = env.INTERVIEW_ORCHESTRATOR_ABANDON_AFTER_MS,
    pausedTimeoutMs = env.INTERVIEW_ORCHESTRATOR_PAUSED_ABANDON_AFTER_MS,
    batchSize = 100,
    logger = console,
  } = {}) {
    this.intervalMs = Math.max(1000, Number(intervalMs) || 60 * 1000);
    this.inactivityTimeoutMs = Math.max(1000, Number(inactivityTimeoutMs) || 2 * 60 * 60 * 1000);
    this.pausedTimeoutMs = Math.max(1000, Number(pausedTimeoutMs) || 24 * 60 * 60 * 1000);
    this.batchSize = Math.max(1, Number(batchSize) || 100);
    this.logger = logger;
    this.timer = null;
    this.running = false;
    this.sweeping = null;
  }

  /** One sweep pass. Never throws; returns the number of sessions abandoned. */
  async sweepOnce(now = new Date()) {
    const cutoffs = {
      [SESSION_STATUSES.IN_PROGRESS]: new Date(now.getTime() - this.inactivityTimeoutMs),
      [SESSION_STATUSES.PAUSED]: new Date(now.getTime() - this.pausedTimeoutMs),
    };
    let abandoned = 0;
    try {
      const stale = await InterviewSession.find({
        $or: SWEEPABLE_STATUSES.map((status) => ({ status, lastActivityAt: { $lt: cutoffs[status] } })),
      })
        .sort({ lastActivityAt: 1 })
        .limit(this.batchSize)
        .lean();

      for (const session of stale) {
        try {
          if (await abandonInactiveSession(session, { now, cutoff: cutoffs[session.status] })) abandoned += 1;
        } catch (err) {
          this.logger.error(
            `[inactivity-sweeper] failed to abandon session ${session.sessionId}:`,
            err?.message || err
          );
        }
      }
    } catch (err) {
      this.logger.error('[inactivity-sweeper] sweep failed:', err?.message || err);
    }
    return abandoned;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  scheduleNext() {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.sweeping = this.sweepOnce()
        .catch(() => 0)
        .finally(() => {
          this.sweeping = null;
          this.scheduleNext();
        });
    }, this.intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  async stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.sweeping) await this.sweeping;
  }
}

module.exports = {
  InactivitySweeper,
  abandonInactiveSession,
};
