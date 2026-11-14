const { isTerminalStatus } = require('../session/session-state-machine');

const validateAdaptiveProposal = ({
  proposedDecision,
  session,
  blueprint,
  currentStage,
  currentQuestion,
  nextQuestionCandidate,
  nextStageCandidate,
  followUpPolicy,
  timeSnapshot,
}) => {
  const warnings = [];
  const askedSet = new Set(session.askedQuestionIds || []);
  const stageIds = new Set((session.stageProgress || []).map((s) => s.stageId));

  if (!proposedDecision) {
    return { valid: false, reason: 'Missing proposed decision', warnings };
  }

  const action = proposedDecision.action;

  // Guard 1: Never allow jumping to an unknown stage or skipping backward
  if (proposedDecision.recommendedNextStageId) {
    if (!stageIds.has(proposedDecision.recommendedNextStageId)) {
      warnings.push(`Rejected unknown recommendedNextStageId '${proposedDecision.recommendedNextStageId}'`);
      return { valid: false, reason: 'Invalid recommendedNextStageId', warnings };
    }
    const currentIdx = (session.stageProgress || []).findIndex(
      (s) => s.stageId === session.currentStageId
    );
    const targetIdx = (session.stageProgress || []).findIndex(
      (s) => s.stageId === proposedDecision.recommendedNextStageId
    );
    if (targetIdx < currentIdx) {
      warnings.push('Rejected backward stage jump');
      return { valid: false, reason: 'Backward stage transition not allowed', warnings };
    }
  }

  // Guard 2: Never repeat an already asked core question
  if (
    action === 'MOVE_NEXT_QUESTION' &&
    proposedDecision.recommendedNextQuestionId &&
    askedSet.has(proposedDecision.recommendedNextQuestionId)
  ) {
    warnings.push(
      `Rejected duplicate question '${proposedDecision.recommendedNextQuestionId}'`
    );
    return { valid: false, reason: 'Duplicate question proposed', warnings };
  }

  // Guard 3: Enforce follow-up cap and allowed probe types
  if (action === 'ASK_FOLLOW_UP') {
    if (!currentQuestion) {
      return { valid: false, reason: 'No active question for follow-up', warnings };
    }
    const currentFollowUps = Number(session.currentFollowUpCount || 0);
    if (currentFollowUps >= followUpPolicy.maxFollowUps) {
      warnings.push(
        `Follow-up cap reached (${currentFollowUps}/${followUpPolicy.maxFollowUps})`
      );
      return { valid: false, reason: 'Follow-up limit reached', warnings };
    }
    if (
      timeSnapshot.timeMode === 'TIME_EXPIRED' ||
      timeSnapshot.timeMode === 'CLOSING_SOON'
    ) {
      warnings.push(`Time mode '${timeSnapshot.timeMode}' disallows follow-up`);
      return { valid: false, reason: 'Insufficient remaining time for follow-up', warnings };
    }
    if (
      proposedDecision.followUpType &&
      proposedDecision.followUpType !== 'NONE' &&
      !followUpPolicy.allowedProbeTypes.includes(proposedDecision.followUpType)
    ) {
      warnings.push(
        `Probe type '${proposedDecision.followUpType}' normalized to '${followUpPolicy.allowedProbeTypes[0]}'`
      );
    }
  }

  // Guard 4: Cannot move to next question if none remain in stage
  if (action === 'MOVE_NEXT_QUESTION' && !nextQuestionCandidate) {
    return {
      valid: false,
      reason: 'No unasked questions remaining in current stage',
      warnings,
    };
  }

  // Guard 5: Cannot advance stage if no next stage exists (must wrap up)
  if (action === 'ADVANCE_STAGE' && !nextStageCandidate) {
    return {
      valid: false,
      reason: 'No remaining stages; must wrap up interview',
      warnings,
    };
  }

  if (isTerminalStatus(session.status)) {
    return { valid: false, reason: 'Session is already terminal', warnings };
  }

  return {
    valid: true,
    reason: null,
    warnings,
    normalizedFollowUpType:
      action === 'ASK_FOLLOW_UP'
        ? followUpPolicy.allowedProbeTypes.includes(proposedDecision.followUpType)
          ? proposedDecision.followUpType
          : followUpPolicy.allowedProbeTypes[0]
        : 'NONE',
  };
};

module.exports = {
  validateAdaptiveProposal,
};
