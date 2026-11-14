const asyncHandler = require('../../utils/asyncHandler');
const {
  createInterviewRuntimeService,
} = require('./runtime/interview-runtime.service');
const {
  toCandidateSession,
  toCandidateTurn,
  toInternalSessionContext,
  toCandidateHint,
  toCandidateAttempt,
} = require('./serializers/session.serializer');
const guidedPracticeService = require('./practice/guided-practice.service');

let activeRuntimeService = createInterviewRuntimeService();

const setRuntimeService = (service) => {
  activeRuntimeService = service || createInterviewRuntimeService();
};

const getRuntimeService = () => activeRuntimeService;

exports.setRuntimeService = setRuntimeService;
exports.getRuntimeService = getRuntimeService;

exports.createSession = asyncHandler(async (req, res) => {
  const session = await activeRuntimeService.createSession({
    intakeId: req.params.intakeId,
    userId: req.auth.userId,
    blueprintId: req.body?.blueprintId || null,
    practiceMode: req.body?.practiceMode || 'REALISTIC_MOCK',
    competencyId: req.body?.competencyId || null,
    maxQuestions: req.body?.maxQuestions ?? null,
  });

  res.status(201).json({
    success: true,
    data: toCandidateSession(session),
  });
});

exports.startSession = asyncHandler(async (req, res) => {
  const { session, openingTurn, tts } = await activeRuntimeService.startSession({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
    consentGranted: req.body?.consentGranted === true,
  });

  res.status(200).json({
    success: true,
    data: {
      session: toCandidateSession(session),
      openingTurn: toCandidateTurn(openingTurn),
      tts: tts
        ? {
            ok: tts.ok,
            fallbackToBrowser: Boolean(tts.fallbackToBrowser),
            mimeType: tts.mimeType || null,
            audioBase64: tts.audioBase64 || null,
          }
        : null,
    },
  });
});

exports.pauseSession = asyncHandler(async (req, res) => {
  const session = await activeRuntimeService.pauseSession({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
    reason: req.body?.reason || 'CANDIDATE_REQUESTED',
  });

  res.status(200).json({
    success: true,
    data: toCandidateSession(session),
  });
});

exports.resumeSession = asyncHandler(async (req, res) => {
  const session = await activeRuntimeService.resumeSession({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: toCandidateSession(session),
  });
});

exports.endSession = asyncHandler(async (req, res) => {
  const { session } = await activeRuntimeService.endSession({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
    reason: req.body?.reason || 'CANDIDATE_ENDED',
    abandon: req.body?.abandon === true,
  });

  res.status(200).json({
    success: true,
    data: toCandidateSession(session),
  });
});

exports.submitCandidateTurn = asyncHandler(async (req, res) => {
  const result = await activeRuntimeService.processTurn({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
    idempotencyKey: req.body.idempotencyKey,
    transcriptText: req.body.transcriptText || '',
    audioBuffer: req.file?.buffer || null,
    mimeType: req.file?.mimetype || 'audio/webm',
    filename: req.file?.originalname || 'audio.webm',
    transcriptStatus: req.body.transcriptStatus || 'FINAL',
    confidence: req.body.confidence ?? null,
    expectedStateVersion: req.body.expectedStateVersion ?? null,
    bypassOwnership: false,
  });

  res.status(200).json({
    success: true,
    data: {
      idempotentReplay: Boolean(result.idempotentReplay),
      ignored: Boolean(result.ignored),
      reason: result.reason || null,
      session: toCandidateSession(result.session),
      candidateTurn: toCandidateTurn(result.candidateTurn),
      aiTurn: toCandidateTurn(result.aiTurn),
      tts: result.tts
        ? {
            ok: result.tts.ok,
            fallbackToBrowser: Boolean(result.tts.fallbackToBrowser),
            mimeType: result.tts.mimeType || null,
            audioBase64: result.tts.audioBase64 || null,
          }
        : null,
    },
  });
});

exports.interruptSession = asyncHandler(async (req, res) => {
  // Verify ownership first
  await activeRuntimeService.getSession({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
  });

  const result = await activeRuntimeService.handleInterruption({
    sessionId: req.params.sessionId,
    turnNumber: req.body?.turnNumber || null,
    interruptedAtMs: req.body?.interruptedAtMs || 0,
    reason: req.body?.reason || 'CANDIDATE_BARGE_IN',
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

exports.getSession = asyncHandler(async (req, res) => {
  const session = await activeRuntimeService.getSession({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: toCandidateSession(session),
  });
});

exports.getTranscript = asyncHandler(async (req, res) => {
  const { session, turns } = await activeRuntimeService.getTranscript({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: {
      sessionId: session.sessionId,
      status: session.status,
      turns: turns.map(toCandidateTurn),
    },
  });
});

exports.getProgress = asyncHandler(async (req, res) => {
  const { session, timeSnapshot } = await activeRuntimeService.getProgress({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: {
      sessionId: session.sessionId,
      status: session.status,
      currentStageId: session.currentStageId,
      currentQuestionId: session.currentQuestionId,
      totalTurnCount: session.totalTurnCount,
      stageProgress: toCandidateSession(session).stageProgress,
      timing: {
        totalDurationSeconds: timeSnapshot.totalDurationSeconds,
        activeDurationSeconds: timeSnapshot.activeDurationSeconds,
        pausedDurationSeconds: timeSnapshot.pausedDurationSeconds,
        remainingSessionSeconds: timeSnapshot.remainingSessionSeconds,
        timeMode: timeSnapshot.timeMode,
      },
    },
  });
});

// Internal Orchestrator / Module 6 Endpoints
exports.internalSubmitTurn = asyncHandler(async (req, res) => {
  const result = await activeRuntimeService.processTurn({
    sessionId: req.params.sessionId,
    idempotencyKey: req.body.idempotencyKey,
    transcriptText: req.body.transcriptText || '',
    audioBuffer: req.file?.buffer || null,
    mimeType: req.file?.mimetype || 'audio/webm',
    filename: req.file?.originalname || 'audio.webm',
    transcriptStatus: req.body.transcriptStatus || 'FINAL',
    confidence: req.body.confidence ?? null,
    expectedStateVersion: req.body.expectedStateVersion ?? null,
    bypassOwnership: true,
  });

  res.status(200).json({
    success: true,
    data: {
      idempotentReplay: Boolean(result.idempotentReplay),
      ignored: Boolean(result.ignored),
      reason: result.reason || null,
      session: result.session,
      candidateTurn: result.candidateTurn,
      aiTurn: result.aiTurn,
      tts: result.tts || null,
    },
  });
});

exports.internalGetContext = asyncHandler(async (req, res) => {
  const ctx = await activeRuntimeService.getInternalContext({
    sessionId: req.params.sessionId,
  });

  res.status(200).json({
    success: true,
    data: toInternalSessionContext(ctx),
  });
});

exports.internalCompleteSession = asyncHandler(async (req, res) => {
  const { session, completedEvent } = await activeRuntimeService.endSession({
    sessionId: req.params.sessionId,
    reason: req.body?.reason || 'ORCHESTRATOR_COMPLETED',
    abandon: req.body?.abandon === true,
    bypassOwnership: true,
  });

  res.status(200).json({
    success: true,
    data: {
      session,
      completedEvent,
    },
  });
});

exports.internalInterruptSession = asyncHandler(async (req, res) => {
  const result = await activeRuntimeService.handleInterruption({
    sessionId: req.params.sessionId,
    turnNumber: req.body?.turnNumber || null,
    interruptedAtMs: req.body?.interruptedAtMs || 0,
    reason: req.body?.reason || 'CANDIDATE_BARGE_IN',
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

exports.internalRetryTurnTts = asyncHandler(async (req, res) => {
  const result = await activeRuntimeService.retryTurnTts({
    sessionId: req.params.sessionId,
    turnId: req.params.turnId,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

exports.requestHint = asyncHandler(async (req, res) => {
  const result = await guidedPracticeService.requestHint({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
    questionId: req.body?.questionId || null,
    idempotencyKey: req.body?.idempotencyKey,
  });

  res.status(200).json({
    success: true,
    data: {
      idempotentReplay: result.idempotentReplay,
      hint: toCandidateHint(result.hint),
      hintsUsedForQuestion: result.hintsUsedForQuestion,
      maxHints: result.maxHints,
      hintsRemaining: result.hintsRemaining,
    },
  });
});

exports.submitPracticeAttempt = asyncHandler(async (req, res) => {
  const result = await guidedPracticeService.submitAttempt({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
    questionId: req.body?.questionId || null,
    answerText: req.body?.answerText || '',
    transcriptText: req.body?.transcriptText || '',
    audioBuffer: req.file?.buffer || null,
    mimeType: req.file?.mimetype || 'audio/webm',
    filename: req.file?.originalname || 'audio.webm',
    transcriptStatus: req.body?.transcriptStatus || 'FINAL',
    confidence: req.body?.confidence ?? null,
    idempotencyKey: req.body?.idempotencyKey,
    sttAdapter: activeRuntimeService?.sttAdapter || null,
  });

  res.status(200).json({
    success: true,
    data: {
      idempotentReplay: Boolean(result.idempotentReplay),
      ignored: Boolean(result.ignored),
      reason: result.reason || null,
      attempt: toCandidateAttempt(result.attempt),
      attemptsUsed: result.attemptsUsed,
      maxAttempts: result.maxAttempts,
      retriesRemaining: result.retriesRemaining,
      awaitingContinue: result.awaitingContinue,
    },
  });
});

exports.getPracticeFeedback = asyncHandler(async (req, res) => {
  const result = await guidedPracticeService.getFeedback({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
    questionId: req.query?.questionId || null,
  });

  res.status(200).json({
    success: true,
    data: {
      questionId: result.questionId,
      attemptsUsed: result.attemptsUsed,
      maxAttempts: result.maxAttempts,
      retriesRemaining: result.retriesRemaining,
      hintsUsed: result.hintsUsed,
      maxHints: result.maxHints,
      attempts: (result.attempts || []).map(toCandidateAttempt),
      hints: (result.hints || []).map(toCandidateHint),
    },
  });
});

exports.preparePracticeRetry = asyncHandler(async (req, res) => {
  const result = await guidedPracticeService.prepareRetry({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
    questionId: req.body?.questionId || null,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

exports.continuePracticeQuestion = asyncHandler(async (req, res) => {
  const result = await guidedPracticeService.continueToNextQuestion({
    sessionId: req.params.sessionId,
    userId: req.auth.userId,
    idempotencyKey: req.body?.idempotencyKey || null,
  });

  res.status(200).json({
    success: true,
    data: {
      idempotentReplay: result.idempotentReplay,
      completed: result.completed,
      session: toCandidateSession(result.session),
      nextQuestion: result.nextQuestion || null,
    },
  });
});
