const env = require('../../../config/env');

const computeElapsedSeconds = (fromDate, toDate = new Date()) => {
  if (!fromDate) return 0;
  const startMs = new Date(fromDate).getTime();
  const endMs = new Date(toDate).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }
  return Math.floor((endMs - startMs) / 1000);
};

const getTimeSnapshot = (session, now = new Date()) => {
  const totalDurationSeconds = Math.max(60, Number(session.totalDurationSeconds) || 2700);
  const activeBase = Number(session.activeDurationSeconds) || 0;
  const deltaActive =
    session.status === 'IN_PROGRESS' && session.lastActivityAt
      ? computeElapsedSeconds(session.lastActivityAt, now)
      : 0;

  const activeDurationSeconds = activeBase + deltaActive;
  const remainingSessionSeconds = Math.max(0, totalDurationSeconds - activeDurationSeconds);

  const currentStage = (session.stageProgress || []).find(
    (s) => s.stageId === session.currentStageId
  );
  const stageAllocated = Number(currentStage?.allocatedDurationSeconds) || 0;
  const stageElapsed =
    (Number(currentStage?.elapsedSeconds) || 0) +
    (session.status === 'IN_PROGRESS' && session.lastActivityAt ? deltaActive : 0);
  const remainingStageSeconds = Math.max(0, stageAllocated - stageElapsed);

  let timeMode = 'NORMAL';
  if (remainingSessionSeconds <= 0) {
    timeMode = 'TIME_EXPIRED';
  } else if (remainingSessionSeconds <= Math.min(180, Math.round(totalDurationSeconds * 0.1))) {
    timeMode = 'CLOSING_SOON';
  } else if (stageAllocated > 0 && remainingStageSeconds <= 0) {
    timeMode = 'STAGE_BUDGET_EXCEEDED';
  }

  const inactivityMs = session.lastActivityAt
    ? Math.max(0, new Date(now).getTime() - new Date(session.lastActivityAt).getTime())
    : 0;

  const isInactiveExpired =
    session.status === 'IN_PROGRESS' &&
    inactivityMs > env.INTERVIEW_ORCHESTRATOR_INACTIVITY_TIMEOUT_MS;

  const isWithinThinkingGrace =
    inactivityMs <= env.INTERVIEW_ORCHESTRATOR_THINKING_GRACE_MS;

  return {
    totalDurationSeconds,
    activeDurationSeconds,
    pausedDurationSeconds: Number(session.pausedDurationSeconds) || 0,
    remainingSessionSeconds,
    stageAllocatedSeconds: stageAllocated,
    stageElapsedSeconds: stageElapsed,
    remainingStageSeconds,
    timeMode,
    inactivityMs,
    isInactiveExpired,
    isWithinThinkingGrace,
  };
};

const accumulateActiveTime = (session, now = new Date()) => {
  if (session.status !== 'IN_PROGRESS' || !session.lastActivityAt) {
    return 0;
  }
  const delta = computeElapsedSeconds(session.lastActivityAt, now);
  if (delta <= 0) return 0;

  session.activeDurationSeconds = (Number(session.activeDurationSeconds) || 0) + delta;
  const stage = (session.stageProgress || []).find(
    (s) => s.stageId === session.currentStageId
  );
  if (stage) {
    stage.elapsedSeconds = (Number(stage.elapsedSeconds) || 0) + delta;
  }
  return delta;
};

const accumulatePausedTime = (session, now = new Date()) => {
  if (session.status !== 'PAUSED' || !session.pausedAt) {
    return 0;
  }
  const delta = computeElapsedSeconds(session.pausedAt, now);
  if (delta > 0) {
    session.pausedDurationSeconds = (Number(session.pausedDurationSeconds) || 0) + delta;
  }
  return delta;
};

module.exports = {
  computeElapsedSeconds,
  getTimeSnapshot,
  accumulateActiveTime,
  accumulatePausedTime,
};
