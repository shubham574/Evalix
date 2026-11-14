const crypto = require('crypto');
const InterviewTurn = require('../turns/interviewTurn.model');
const InterviewEvent = require('../events/interviewEvent.model');

const recordTtsInterruption = async ({
  session,
  turnNumber = null,
  interruptedAtMs = 0,
  reason = 'CANDIDATE_BARGE_IN',
}) => {
  const targetTurnNumber = turnNumber || session.activePrompt?.turnNumber || session.lastCompletedTurnNumber;
  if (!targetTurnNumber) {
    return { interrupted: false, reason: 'No active AI turn to interrupt' };
  }

  const aiTurn = await InterviewTurn.findOne({
    sessionId: session._id,
    turnNumber: targetTurnNumber,
    speaker: 'AI',
  });

  if (!aiTurn) {
    return { interrupted: false, reason: 'AI turn not found' };
  }

  aiTurn.interrupted = true;
  aiTurn.interruptedAtMs = Math.max(0, Number(interruptedAtMs) || 0);
  await aiTurn.save();

  await InterviewEvent.create({
    eventId: `evt_${crypto.randomUUID()}`,
    sessionId: session._id,
    intakeId: session.intakeId,
    eventType: 'TTS_INTERRUPTED',
    payload: {
      turnNumber: aiTurn.turnNumber,
      questionId: aiTurn.questionId,
      stageId: aiTurn.stageId,
      interruptedAtMs: aiTurn.interruptedAtMs,
      reason,
    },
    outboxStatus: 'INTERNAL',
    occurredAt: new Date(),
  });

  // Note: Do NOT mark currentQuestionId completed on interruption so candidate can still answer it.
  return {
    interrupted: true,
    turnNumber: aiTurn.turnNumber,
    questionId: aiTurn.questionId,
    interruptedAtMs: aiTurn.interruptedAtMs,
  };
};

module.exports = {
  recordTtsInterruption,
};
