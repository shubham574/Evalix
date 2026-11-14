const toCandidateStageProgress = (stage) => ({
  stageId: stage.stageId,
  stageType: stage.stageType,
  title: stage.title,
  status: stage.status,
  allocatedDurationSeconds: stage.allocatedDurationSeconds,
  elapsedSeconds: stage.elapsedSeconds,
});

const toCandidateSession = (session) => {
  if (!session) return null;
  const s = typeof session.toObject === 'function' ? session.toObject() : session;
  return {
    id: String(s._id),
    sessionId: s.sessionId,
    intakeId: String(s.intakeId),
    blueprintId: String(s.blueprintId),
    blueprintVersion: s.blueprintVersion,
    interviewType: s.interviewType,
    practiceMode: s.practiceMode || 'REALISTIC_MOCK',
    focusedCompetencyId: s.focusedCompetencyId || null,
    guidedState:
      s.practiceMode === 'GUIDED_PRACTICE' && s.guidedState
        ? {
            currentQuestionId: s.guidedState.currentQuestionId || null,
            currentAttemptCount: s.guidedState.currentAttemptCount || 0,
            hintsUsedForCurrentQuestion: s.guidedState.hintsUsedForCurrentQuestion || 0,
            awaitingContinue: Boolean(s.guidedState.awaitingContinue),
            maxHintsPerQuestion: s.executionSnapshot?.maxHintsPerQuestion || 3,
            maxAttemptsPerQuestion: s.executionSnapshot?.maxAttemptsPerQuestion || 3,
          }
        : null,
    focusedPracticeSummary:
      s.practiceMode === 'FOCUSED_SKILL_PRACTICE' && s.executionSnapshot
        ? {
            focusedCompetencyId: s.focusedCompetencyId || null,
            plannedQuestionCount: Array.isArray(s.executionSnapshot.questionPlan)
              ? s.executionSnapshot.questionPlan.length
              : 0,
            maxQuestions: s.executionSnapshot.maxQuestions || null,
          }
        : null,
    targetRole: s.targetRole,
    seniorityLevel: s.seniorityLevel,
    status: s.status,
    consentRequired: Boolean(s.consentRequired),
    consentGranted: Boolean(s.consentGranted),
    consentRecordedAt: s.consentRecordedAt || null,
    currentStageId: s.currentStageId || null,
    currentStageIndex: s.currentStageIndex ?? 0,
    currentQuestionId: s.currentQuestionId || null,
    totalTurnCount: s.totalTurnCount ?? 0,
    stageProgress: (s.stageProgress || []).map(toCandidateStageProgress),
    activePrompt: s.activePrompt
      ? {
          turnNumber: s.activePrompt.turnNumber || 0,
          stageId: s.activePrompt.stageId || null,
          questionId: s.activePrompt.questionId || null,
          isFollowUp: Boolean(s.activePrompt.isFollowUp),
          text: s.activePrompt.text || '',
        }
      : null,
    totalDurationSeconds: s.totalDurationSeconds,
    activeDurationSeconds: s.activeDurationSeconds ?? 0,
    pausedDurationSeconds: s.pausedDurationSeconds ?? 0,
    startedAt: s.startedAt || null,
    pausedAt: s.pausedAt || null,
    completedAt: s.completedAt || null,
    abandonedAt: s.abandonedAt || null,
    terminationReason: s.terminationReason || null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
};

const toCandidateTurn = (turn) => {
  if (!turn) return null;
  const t = typeof turn.toObject === 'function' ? turn.toObject() : turn;
  return {
    id: String(t._id),
    turnNumber: t.turnNumber,
    speaker: t.speaker,
    turnType: t.turnType,
    stageId: t.stageId || null,
    questionId: t.questionId || null,
    spokenText: t.spokenText || '',
    transcriptStatus: t.transcriptStatus,
    processingStatus: t.processingStatus,
    interrupted: Boolean(t.interrupted),
    ttsFallbackToBrowser: Boolean(t.ttsMetadata?.fallbackToBrowser),
    startedAt: t.startedAt || null,
    endedAt: t.endedAt || null,
  };
};

const toInternalSessionContext = ({ session, memory, turns, events }) => {
  const s = typeof session.toObject === 'function' ? session.toObject() : session;
  return {
    session: s,
    memory: memory || null,
    turns: (turns || []).map((t) => (typeof t.toObject === 'function' ? t.toObject() : t)),
    events: (events || []).map((e) => (typeof e.toObject === 'function' ? e.toObject() : e)),
  };
};

const toCandidateHint = (hint) => {
  if (!hint) return null;
  const h = typeof hint.toObject === 'function' ? hint.toObject() : hint;
  return {
    id: String(h._id),
    questionId: h.questionId,
    competencyId: h.competencyId || null,
    hintLevel: h.hintLevel,
    hintType: h.hintType,
    hintText: h.hintText,
    createdAt: h.createdAt,
  };
};

const toCandidateAttempt = (attempt) => {
  if (!attempt) return null;
  const a = typeof attempt.toObject === 'function' ? attempt.toObject() : attempt;
  return {
    id: String(a._id),
    questionId: a.questionId,
    competencyId: a.competencyId || null,
    attemptNumber: a.attemptNumber,
    answerText: a.answerText,
    feedback: a.feedback || null,
    isSelectedForEvaluation: Boolean(a.isSelectedForEvaluation),
    createdAt: a.createdAt,
  };
};

module.exports = {
  toCandidateSession,
  toCandidateTurn,
  toInternalSessionContext,
  toCandidateHint,
  toCandidateAttempt,
};
