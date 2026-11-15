const detectPromptingContext = ({ aiTurns = [], candidateTurns = [] }) => {
  if (candidateTurns.length === 0) return 'UNVERIFIABLE';

  const hasInterviewerSupplied = aiTurns.some((t) =>
    /the answer is|actually it works by|to be specific, you should use/i.test(t.spokenText || '')
  );
  if (hasInterviewerSupplied) return 'INTERVIEWER_SUPPLIED';

  const hasHint = aiTurns.some(
    (t) =>
      t.turnType === 'FOLLOW_UP' &&
      /hint|think about|consider|what about/i.test(t.spokenText || '')
  );
  if (hasHint) return 'HINT_SUPPORTED';

  const hasClarification = aiTurns.some((t) => t.turnType === 'CLARIFICATION');
  if (hasClarification) return 'CLARIFICATION_SUPPORTED';

  return 'UNPROMPTED';
};

const assembleQuestionResponses = ({ session, internalBlueprint, validTurns = [], invalidTurns = [] }) => {
  const questionPlan = Array.isArray(internalBlueprint.questionPlan)
    ? internalBlueprint.questionPlan
    : [];
  const askedSet = new Set(session.askedQuestionIds || []);
  const completedSet = new Set(session.completedQuestionIds || []);
  const skippedSet = new Set(session.skippedQuestionIds || []);
  const skippedStages = new Set(
    (session.stageProgress || [])
      .filter((s) => s.status === 'SKIPPED')
      .map((s) => s.stageId)
  );
  const focusedCompetencyId =
    session?.practiceMode === 'FOCUSED_SKILL_PRACTICE' ? session.focusedCompetencyId || null : null;

  return questionPlan.map((q) => {
    const qId = q.questionId;
    const qCompetencyId = q.competencyId || q.competencyIds?.[0] || null;
    const excludedByFocusedScope = Boolean(
      focusedCompetencyId && qCompetencyId !== focusedCompetencyId
    );
    const qTurns = validTurns.filter((t) => t.questionId === qId);
    const qInvalidTurns = invalidTurns.filter((t) => t.questionId === qId);

    const aiTurns = qTurns.filter((t) => t.speaker === 'AI');
    const candidateTurns = qTurns.filter((t) => t.speaker === 'CANDIDATE');
    const interruptedAiTurns = aiTurns.filter((t) => Boolean(t.interrupted));

    const wasAsked = !excludedByFocusedScope && (askedSet.has(qId) || aiTurns.length > 0);
    const wasCompleted = !excludedByFocusedScope && completedSet.has(qId);
    const wasInterrupted = interruptedAiTurns.length > 0 && candidateTurns.length === 0;
    const excludedByStage = skippedStages.has(q.stageId) || excludedByFocusedScope;
    const hasInvalidTranscript = candidateTurns.length === 0 && qInvalidTurns.length > 0;

    const wasSkippedByCandidate =
      skippedSet.has(qId) ||
      candidateTurns.some((t) => t.sttMetadata?.classification?.intent === 'REQUEST_SKIP');

    const substantiveCandidateTurns = candidateTurns.filter((t) => {
      const intent = t.sttMetadata?.classification?.intent;
      if (intent) {
        return intent === 'SUBSTANTIVE_ANSWER';
      }
      const text = (t.spokenText || t.rawTranscript || '').trim().toLowerCase();
      return !['yes', 'yeah', 'ok', 'okay', 'no', 'sure', 'got it', 'pass', 'skip'].includes(text);
    });
    const hasSubstantiveAnswer = substantiveCandidateTurns.length > 0;

    const promptingContext = detectPromptingContext({ aiTurns, candidateTurns });

    const codeArtifacts = candidateTurns
      .map((t) => t.sttMetadata?.codeArtifact || null)
      .filter(Boolean);

    return {
      questionId: qId,
      stageId: q.stageId,
      competencyId: q.competencyId || q.competencyIds?.[0] || null,
      questionType: q.questionType || q.questionCategory || 'TECHNICAL',
      questionText: q.questionText || q.prompt || '',
      evaluationRubricId: q.evaluationRubricId || null,
      expectedEvidence: Array.isArray(q.expectedEvidence) ? q.expectedEvidence : [],
      weight: Number.isFinite(Number(q.weight)) ? Number(q.weight) : null,
      wasAsked,
      wasCompleted,
      wasInterrupted,
      wasSkippedByCandidate,
      hasSubstantiveAnswer,
      excludedByStage,
      hasInvalidTranscript,
      promptingContext,
      aiTurns: aiTurns.map((t) => ({
        turnId: String(t._id),
        turnNumber: t.turnNumber,
        turnType: t.turnType,
        spokenText: t.spokenText,
        interrupted: Boolean(t.interrupted),
        timestamp: t.startedAt || t.createdAt,
      })),
      candidateTurns: candidateTurns.map((t) => ({
        turnId: String(t._id),
        turnNumber: t.turnNumber,
        spokenText: t.spokenText || t.rawTranscript || '',
        transcriptStatus: t.transcriptStatus,
        timestamp: t.startedAt || t.createdAt,
      })),
      codeArtifacts,
    };
  });
};

module.exports = {
  assembleQuestionResponses,
  detectPromptingContext,
};
