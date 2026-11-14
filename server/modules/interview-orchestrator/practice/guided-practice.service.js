const crypto = require('crypto');
const env = require('../../../config/env');
const ApiError = require('../../../utils/ApiError');
const { withTransaction } = require('../../common/db/transaction');
const InterviewSession = require('../session/interviewSession.model');
const InterviewTurn = require('../turns/interviewTurn.model');
const InterviewEvent = require('../events/interviewEvent.model');
const { InterviewBlueprint } = require('../../interview-blueprint/models/interviewBlueprint.model');
const {
  toInternalOrchestratorBlueprint,
} = require('../../interview-blueprint/serializers/blueprint.serializer');
const {
  buildAnswerImprovementGuidance,
} = require('../../decision-intelligence/coaching/answer-improvement.service');
const PracticeAttempt = require('./practiceAttempt.model');
const { PracticeHint } = require('./practiceHint.model');
const { createSttAdapter } = require('../voice/stt.adapter');

const HINT_LEVEL_MAP = {
  1: 'LIGHT',
  2: 'STRUCTURE',
  3: 'CONCEPT',
};

const getQuestionLearningObjective = (question, internalBlueprint) => {
  const comp = (internalBlueprint?.competencies || []).find(
    (c) => c.competencyId === question?.competencyId
  );
  const compName = comp?.name || comp?.title || question?.competencyId || 'Core Competency';
  return `Practice articulating clear, concrete reasoning for ${compName} using specific examples and trade-offs.`;
};

const sanitizeHintText = (text) => {
  const cleaned = String(text || '').trim();
  if (!cleaned) {
    return 'Focus on explaining your concrete approach, key trade-offs, and measurable outcome.';
  }
  return cleaned;
};

const buildHintText = async ({ question, hintLevel, hintType, llmProvider }) => {
  if (llmProvider && typeof llmProvider.generateText === 'function') {
    const prompt = [
      `You are an interview practice coach giving a Level ${hintLevel} (${hintType}) hint.`,
      'Do NOT reveal an answer key, rubric criteria, or full solution.',
      hintLevel === 1
        ? 'Give a gentle nudge on what aspect of the question to focus on.'
        : hintLevel === 2
        ? 'Suggest a clear answer structure (e.g., Context, Action, Trade-offs, Result).'
        : 'Explain the underlying technical or behavioral concept to apply.',
      `Question: ${question.prompt || question.questionText}`,
    ].join('\n');

    try {
      const result = await llmProvider.generateText({ prompt });
      const text = typeof result === 'string' ? result : result?.text || result?.hintText;
      if (text && String(text).trim()) {
        return sanitizeHintText(text);
      }
    } catch (_) {
      // Deterministic fallback below
    }
  }

  const qType = (question?.questionType || question?.questionCategory || 'TECHNICAL').toUpperCase();
  if (hintLevel === 1) {
    return qType === 'BEHAVIORAL'
      ? 'Light hint: Pick one specific real situation you personally handled and name the core challenge up front.'
      : 'Light hint: Clarify your key assumptions first, then focus on the primary constraint in the question.';
  }
  if (hintLevel === 2) {
    return qType === 'BEHAVIORAL'
      ? 'Structure hint: Organize your response with STAR — Situation, Task, your specific Actions, and the measurable Result.'
      : 'Structure hint: Break your answer into (1) core design/approach, (2) key trade-offs or edge cases, and (3) verification or outcome.';
  }
  return qType === 'BEHAVIORAL'
    ? 'Concept hint: Interviewers look for personal ownership ("I" vs "we"), how you resolved ambiguity, and what you learned afterward.'
    : 'Concept hint: Connect your choice to reliability, complexity, or maintainability — explain why your approach beats the main alternative.';
};

const loadGuidedSessionAndBlueprint = async (sessionId, userId) => {
  const session = await InterviewSession.findOne({
    $or: [{ sessionId }, ...(sessionId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: sessionId }] : [])],
  });
  if (!session) {
    throw new ApiError(404, 'Interview session not found');
  }
  if (session.userId !== userId) {
    throw new ApiError(403, 'Not authorized to access this interview session');
  }
  if (session.practiceMode !== 'GUIDED_PRACTICE') {
    throw new ApiError(
      409,
      `This action is only available in GUIDED_PRACTICE mode (current mode: '${session.practiceMode}')`
    );
  }
  const blueprintDoc = await InterviewBlueprint.findById(session.blueprintId).lean();
  if (!blueprintDoc) {
    throw new ApiError(404, 'Associated interview blueprint not found');
  }
  const internalBlueprint = toInternalOrchestratorBlueprint(blueprintDoc);
  return { session, internalBlueprint };
};

const resolveTargetQuestion = (session, internalBlueprint, requestedQuestionId = null) => {
  const activeQuestionId = requestedQuestionId || session.currentQuestionId;
  if (!activeQuestionId) {
    throw new ApiError(409, 'No active question in this guided practice session');
  }
  if (requestedQuestionId && requestedQuestionId !== session.currentQuestionId) {
    throw new ApiError(
      409,
      `Question '${requestedQuestionId}' is not the current active question ('${session.currentQuestionId}')`
    );
  }
  const question = (internalBlueprint.questionPlan || []).find(
    (q) => q.questionId === activeQuestionId
  );
  if (!question) {
    throw new ApiError(404, `Question '${activeQuestionId}' not found in session blueprint`);
  }
  return question;
};

const requestHint = async ({
  sessionId,
  userId,
  questionId = null,
  idempotencyKey,
  llmProvider = null,
}) => {
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new ApiError(400, 'idempotencyKey is required for hint requests');
  }

  const { session, internalBlueprint } = await loadGuidedSessionAndBlueprint(sessionId, userId);
  if (session.status !== 'IN_PROGRESS') {
    throw new ApiError(409, `Cannot request hint while session is '${session.status}'`);
  }

  const existingByKey = await PracticeHint.findOne({
    sessionId: session._id,
    idempotencyKey,
  }).lean();
  if (existingByKey) {
    const maxHints =
      session.executionSnapshot?.maxHintsPerQuestion || env.GUIDED_PRACTICE_MAX_HINTS;
    const totalUsed = await PracticeHint.countDocuments({
      sessionId: session._id,
      questionId: existingByKey.questionId,
    });
    return {
      idempotentReplay: true,
      hint: existingByKey,
      hintsUsedForQuestion: totalUsed,
      maxHints,
      hintsRemaining: Math.max(0, maxHints - totalUsed),
    };
  }

  const question = resolveTargetQuestion(session, internalBlueprint, questionId);
  const maxHints =
    session.executionSnapshot?.maxHintsPerQuestion || env.GUIDED_PRACTICE_MAX_HINTS;

  const existingHints = await PracticeHint.find({
    sessionId: session._id,
    questionId: question.questionId,
  })
    .sort({ hintLevel: 1 })
    .lean();

  if (existingHints.length >= maxHints) {
    throw new ApiError(409, `Maximum hints (${maxHints}) reached for this question`);
  }

  const nextLevel = existingHints.length + 1;
  const hintType = HINT_LEVEL_MAP[nextLevel] || 'CONCEPT';
  const hintText = await buildHintText({
    question,
    hintLevel: nextLevel,
    hintType,
    llmProvider,
  });

  let savedHint;
  try {
    savedHint = await PracticeHint.create({
      sessionId: session._id,
      userId,
      questionId: question.questionId,
      competencyId: question.competencyId || null,
      hintLevel: nextLevel,
      hintType,
      idempotencyKey,
      hintText,
      promptVersion: '8.0.0',
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const replay = await PracticeHint.findOne({
        sessionId: session._id,
        idempotencyKey,
      }).lean();
      if (replay) {
        const totalUsed = await PracticeHint.countDocuments({
          sessionId: session._id,
          questionId: replay.questionId,
        });
        return {
          idempotentReplay: true,
          hint: replay,
          hintsUsedForQuestion: totalUsed,
          maxHints,
          hintsRemaining: Math.max(0, maxHints - totalUsed),
        };
      }
      throw new ApiError(409, 'Concurrent hint request conflict; please retry');
    }
    throw err;
  }

  await InterviewSession.updateOne(
    {
      _id: session._id,
      status: 'IN_PROGRESS',
      currentQuestionId: question.questionId,
    },
    {
      $set: {
        'guidedState.hintsUsedForCurrentQuestion': nextLevel,
        lastActivityAt: new Date(),
      },
    }
  );

  return {
    idempotentReplay: false,
    hint: savedHint.toObject(),
    hintsUsedForQuestion: nextLevel,
    maxHints,
    hintsRemaining: Math.max(0, maxHints - nextLevel),
  };
};

const submitAttempt = async ({
  sessionId,
  userId,
  questionId = null,
  answerText = '',
  transcriptText = '',
  audioBuffer = null,
  mimeType = 'audio/webm',
  filename = 'audio.webm',
  transcriptStatus = 'FINAL',
  confidence = null,
  idempotencyKey,
  llmProvider = null,
  sttAdapter = null,
}) => {
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new ApiError(400, 'idempotencyKey is required for attempt submission');
  }

  const { session, internalBlueprint } = await loadGuidedSessionAndBlueprint(sessionId, userId);
  if (session.status !== 'IN_PROGRESS') {
    throw new ApiError(409, `Cannot submit attempt while session is '${session.status}'`);
  }

  const maxAttempts =
    session.executionSnapshot?.maxAttemptsPerQuestion || env.GUIDED_PRACTICE_MAX_ATTEMPTS;

  const existingByKey = await PracticeAttempt.findOne({
    sessionId: session._id,
    idempotencyKey,
  }).lean();
  if (existingByKey) {
    const totalAttempts = await PracticeAttempt.countDocuments({
      sessionId: session._id,
      questionId: existingByKey.questionId,
    });
    return {
      idempotentReplay: true,
      ignored: false,
      attempt: existingByKey,
      attemptsUsed: totalAttempts,
      maxAttempts,
      retriesRemaining: Math.max(0, maxAttempts - totalAttempts),
      awaitingContinue: true,
    };
  }

  const question = resolveTargetQuestion(session, internalBlueprint, questionId);

  const activeStt = sttAdapter || createSttAdapter();
  const rawTextInput = String(answerText || transcriptText || '');
  const sttResult = await activeStt.resolveCandidateInput({
    audioBuffer,
    mimeType,
    filename,
    transcriptText: rawTextInput,
    transcriptStatus,
    confidence,
  });

  if (sttResult.ignoredForDecision) {
    const currentAttempts = await PracticeAttempt.countDocuments({
      sessionId: session._id,
      questionId: question.questionId,
    });
    return {
      idempotentReplay: false,
      ignored: true,
      reason: sttResult.reason || 'PARTIAL_TRANSCRIPT_IGNORED',
      attempt: null,
      attemptsUsed: currentAttempts,
      maxAttempts,
      retriesRemaining: Math.max(0, maxAttempts - currentAttempts),
      awaitingContinue: Boolean(session.guidedState?.awaitingContinue),
    };
  }

  const trimmedAnswer = String(sttResult.transcript || '').trim();
  if (sttResult.emptyTranscript || !trimmedAnswer) {
    throw new ApiError(400, 'answerText or audible speech is required');
  }
  if (trimmedAnswer.length > 15000) {
    throw new ApiError(400, 'Answer transcript exceeds maximum allowed length (15000 characters)');
  }

  const existingAttempts = await PracticeAttempt.find({
    sessionId: session._id,
    questionId: question.questionId,
  })
    .sort({ attemptNumber: 1 })
    .lean();

  if (existingAttempts.length >= maxAttempts) {
    throw new ApiError(
      409,
      `Maximum attempts (${maxAttempts}) reached for this question; please continue to the next question`
    );
  }

  const attemptNumber = existingAttempts.length + 1;

  // Reuse Module 7 answer-improvement coaching service
  const syntheticQuestionEval = {
    questionId: question.questionId,
    questionText: question.prompt || question.questionText || '',
    competencyId: question.competencyId || null,
    evaluationStatus: 'EVALUATED',
    strengths: [],
    developmentAreas: [],
  };
  const syntheticTurn = {
    speaker: 'CANDIDATE',
    questionId: question.questionId,
    spokenText: trimmedAnswer,
  };

  const guidanceItems = await buildAnswerImprovementGuidance(
    {
      questionEvaluations: [syntheticQuestionEval],
      turns: [syntheticTurn],
    },
    { llmProvider }
  );
  const coaching = guidanceItems[0] || {};
  const feedback = {
    coachingSummary:
      coaching.improvementFocus ||
      'Review how clearly your answer addresses the core problem, trade-offs, and outcome.',
    whatWorked:
      trimmedAnswer.length >= 80
        ? ['Provided substantive detail in your explanation.']
        : ['Started addressing the question directly.'],
    whatWasMissing:
      trimmedAnswer.length >= 80
        ? ['Consider tightening measurable impact and explicit trade-offs.']
        : ['Add concrete implementation steps, edge cases, and measurable results.'],
    improvedAnswerFramework: coaching.improvedAnswerFramework || '',
    suggestedStructure: Array.isArray(coaching.suggestedStructure)
      ? coaching.suggestedStructure
      : [],
    exampleUpgradeNotes: coaching.exampleUpgradeNotes || '',
    promptVersion: coaching.promptVersion || '7.0.0',
    generatedAt: new Date().toISOString(),
  };

  let savedAttempt;
  try {
    savedAttempt = await withTransaction(async (dbSession) => {
      await PracticeAttempt.updateMany(
        { sessionId: session._id, questionId: question.questionId, isSelectedForEvaluation: true },
        { $set: { isSelectedForEvaluation: false } },
        dbSession ? { session: dbSession } : undefined
      );

      const [created] = dbSession
        ? await PracticeAttempt.create(
            [
              {
                sessionId: session._id,
                userId,
                questionId: question.questionId,
                competencyId: question.competencyId || null,
                stageId: question.stageId || null,
                attemptNumber,
                idempotencyKey,
                answerText: trimmedAnswer,
                transcriptStatus: 'FINAL',
                feedback,
                isSelectedForEvaluation: true,
              },
            ],
            { session: dbSession }
          )
        : [
            await PracticeAttempt.create({
              sessionId: session._id,
              userId,
              questionId: question.questionId,
              competencyId: question.competencyId || null,
              stageId: question.stageId || null,
              attemptNumber,
              idempotencyKey,
              answerText: trimmedAnswer,
              transcriptStatus: 'FINAL',
              feedback,
              isSelectedForEvaluation: true,
            }),
          ];

      const lockedSession = await InterviewSession.findOneAndUpdate(
        {
          _id: session._id,
          status: 'IN_PROGRESS',
          currentQuestionId: question.questionId,
          'guidedState.continuedQuestionIds': { $ne: question.questionId },
        },
        {
          $set: {
            'guidedState.currentAttemptCount': attemptNumber,
            'guidedState.awaitingContinue': true,
            [`guidedState.selectedAttemptIdByQuestion.${question.questionId}`]: String(created._id),
            lastActivityAt: new Date(),
          },
        },
        { returnDocument: 'after', ...(dbSession ? { session: dbSession } : {}) }
      );

      if (!lockedSession) {
        throw new ApiError(
          409,
          'Question has already advanced or session is no longer accepting attempts'
        );
      }

      return created;
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const replay = await PracticeAttempt.findOne({
        sessionId: session._id,
        idempotencyKey,
      }).lean();
      if (replay) {
        const totalAttempts = await PracticeAttempt.countDocuments({
          sessionId: session._id,
          questionId: replay.questionId,
        });
        return {
          idempotentReplay: true,
          attempt: replay,
          attemptsUsed: totalAttempts,
          maxAttempts,
          retriesRemaining: Math.max(0, maxAttempts - totalAttempts),
          awaitingContinue: true,
        };
      }
      throw new ApiError(409, 'Concurrent attempt submission conflict; please retry');
    }
    throw err;
  }

  return {
    idempotentReplay: false,
    attempt: savedAttempt.toObject(),
    attemptsUsed: attemptNumber,
    maxAttempts,
    retriesRemaining: Math.max(0, maxAttempts - attemptNumber),
    awaitingContinue: true,
  };
};

const getFeedback = async ({ sessionId, userId, questionId = null }) => {
  const { session } = await loadGuidedSessionAndBlueprint(sessionId, userId);
  const targetQuestionId = questionId || session.currentQuestionId;
  if (!targetQuestionId) {
    throw new ApiError(409, 'No active question to inspect feedback for');
  }

  const [attempts, hints] = await Promise.all([
    PracticeAttempt.find({
      sessionId: session._id,
      questionId: targetQuestionId,
    })
      .sort({ attemptNumber: 1 })
      .lean(),
    PracticeHint.find({
      sessionId: session._id,
      questionId: targetQuestionId,
    })
      .sort({ hintLevel: 1 })
      .lean(),
  ]);

  const maxAttempts =
    session.executionSnapshot?.maxAttemptsPerQuestion || env.GUIDED_PRACTICE_MAX_ATTEMPTS;
  const maxHints =
    session.executionSnapshot?.maxHintsPerQuestion || env.GUIDED_PRACTICE_MAX_HINTS;

  return {
    questionId: targetQuestionId,
    attemptsUsed: attempts.length,
    maxAttempts,
    retriesRemaining: Math.max(0, maxAttempts - attempts.length),
    hintsUsed: hints.length,
    maxHints,
    attempts,
    hints,
  };
};

const prepareRetry = async ({ sessionId, userId, questionId = null }) => {
  const { session, internalBlueprint } = await loadGuidedSessionAndBlueprint(sessionId, userId);
  if (session.status !== 'IN_PROGRESS') {
    throw new ApiError(409, `Cannot retry while session is '${session.status}'`);
  }

  const question = resolveTargetQuestion(session, internalBlueprint, questionId);
  const maxAttempts =
    session.executionSnapshot?.maxAttemptsPerQuestion || env.GUIDED_PRACTICE_MAX_ATTEMPTS;

  const attemptsUsed = await PracticeAttempt.countDocuments({
    sessionId: session._id,
    questionId: question.questionId,
  });

  if (attemptsUsed < 1) {
    throw new ApiError(409, 'Submit an initial attempt before requesting a retry');
  }
  if (attemptsUsed >= maxAttempts) {
    throw new ApiError(
      409,
      `Retry limit reached (${maxAttempts} attempts used); please continue to the next question`
    );
  }

  const lockedSession = await InterviewSession.findOneAndUpdate(
    {
      _id: session._id,
      status: 'IN_PROGRESS',
      currentQuestionId: question.questionId,
      'guidedState.continuedQuestionIds': { $ne: question.questionId },
    },
    {
      $set: {
        'guidedState.awaitingContinue': false,
        lastActivityAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!lockedSession) {
    throw new ApiError(409, 'Question has already advanced or session is no longer active');
  }

  return {
    questionId: question.questionId,
    attemptsUsed,
    maxAttempts,
    retriesRemaining: maxAttempts - attemptsUsed,
    nextAttemptNumber: attemptsUsed + 1,
    learningObjective: getQuestionLearningObjective(question, internalBlueprint),
  };
};

const continueToNextQuestion = async ({
  sessionId,
  userId,
  idempotencyKey = null,
}) => {
  const { session, internalBlueprint } = await loadGuidedSessionAndBlueprint(sessionId, userId);

  const currentQuestionId = session.currentQuestionId;
  const continuedIds = Array.isArray(session.guidedState?.continuedQuestionIds)
    ? session.guidedState.continuedQuestionIds
    : [];

  // Idempotent replay if already completed or continued with same key
  if (
    session.status === 'COMPLETED' ||
    (idempotencyKey && session.guidedState?.lastContinueIdempotencyKey === idempotencyKey)
  ) {
    return {
      idempotentReplay: true,
      completed: session.status === 'COMPLETED',
      session: session.toObject(),
      nextQuestion: null,
    };
  }

  if (session.status !== 'IN_PROGRESS') {
    throw new ApiError(409, `Cannot continue while session is '${session.status}'`);
  }
  if (!currentQuestionId || continuedIds.includes(currentQuestionId)) {
    return {
      idempotentReplay: true,
      completed: false,
      session: session.toObject(),
      nextQuestion: null,
    };
  }

  const attempts = await PracticeAttempt.find({
    sessionId: session._id,
    questionId: currentQuestionId,
  })
    .sort({ attemptNumber: 1 })
    .lean();

  if (attempts.length === 0) {
    throw new ApiError(
      409,
      'Submit at least one answer attempt before continuing to the next question'
    );
  }

  const selectedAttempt =
    attempts.find((a) => a.isSelectedForEvaluation) || attempts[attempts.length - 1];
  const currentQuestion = (internalBlueprint.questionPlan || []).find(
    (q) => q.questionId === currentQuestionId
  );

  const askedSet = new Set(session.askedQuestionIds || []);
  const completedSet = new Set([...(session.completedQuestionIds || []), currentQuestionId]);
  const nextQuestion = (internalBlueprint.questionPlan || []).find(
    (q) => !askedSet.has(q.questionId) && !completedSet.has(q.questionId)
  );

  const now = new Date();
  const expectedVersion = session.stateVersion;

  let updated;
  try {
    updated = await withTransaction(async (dbSession) => {
      const candidateTurnNumber = session.totalTurnCount + 1;
      const turnIdempotencyKey = `guided_selected_${session._id}_${currentQuestionId}`;
      const updatedCovered = Array.from(
        new Set([
          ...(session.coveredCompetencyIds || []),
          ...(currentQuestion?.competencyId ? [currentQuestion.competencyId] : []),
        ])
      );

      let savedSession;
      if (!nextQuestion) {
        savedSession = await InterviewSession.findOneAndUpdate(
          {
            _id: session._id,
            stateVersion: expectedVersion,
            status: 'IN_PROGRESS',
            currentQuestionId,
          },
          {
            $set: {
              status: 'COMPLETED',
              completedAt: now,
              lastActivityAt: now,
              terminationReason: 'ALL_QUESTIONS_COMPLETED',
              currentQuestionId: null,
              totalTurnCount: candidateTurnNumber,
              lastCompletedTurnNumber: candidateTurnNumber,
              completedQuestionIds: Array.from(completedSet),
              coveredCompetencyIds: updatedCovered,
              stateVersion: expectedVersion + 1,
              'guidedState.awaitingContinue': false,
              'guidedState.lastContinueIdempotencyKey': idempotencyKey || null,
              'guidedState.continuedQuestionIds': [...continuedIds, currentQuestionId],
            },
          },
          { returnDocument: 'after', ...(dbSession ? { session: dbSession } : {}) }
        );
      } else {
        const nextAiTurnNumber = candidateTurnNumber + 1;
        const nextPromptText = nextQuestion.prompt || nextQuestion.questionText;
        const nextStageIdx = (session.stageProgress || []).findIndex(
          (s) => s.stageId === nextQuestion.stageId
        );

        savedSession = await InterviewSession.findOneAndUpdate(
          {
            _id: session._id,
            stateVersion: expectedVersion,
            status: 'IN_PROGRESS',
            currentQuestionId,
          },
          {
            $set: {
              currentStageId: nextQuestion.stageId || session.currentStageId,
              currentStageIndex: nextStageIdx >= 0 ? nextStageIdx : session.currentStageIndex,
              currentQuestionId: nextQuestion.questionId,
              askedQuestionIds: Array.from(
                new Set([...(session.askedQuestionIds || []), nextQuestion.questionId])
              ),
              completedQuestionIds: Array.from(completedSet),
              coveredCompetencyIds: updatedCovered,
              totalTurnCount: nextAiTurnNumber,
              lastCompletedTurnNumber: nextAiTurnNumber,
              lastActivityAt: now,
              stateVersion: expectedVersion + 1,
              activePrompt: {
                turnNumber: nextAiTurnNumber,
                stageId: nextQuestion.stageId,
                questionId: nextQuestion.questionId,
                competencyId: nextQuestion.competencyId || null,
                isFollowUp: false,
                text: nextPromptText,
                startedAt: now,
              },
              'guidedState.currentQuestionId': nextQuestion.questionId,
              'guidedState.currentAttemptCount': 0,
              'guidedState.hintsUsedForCurrentQuestion': 0,
              'guidedState.awaitingContinue': false,
              'guidedState.lastContinueIdempotencyKey': idempotencyKey || null,
              'guidedState.continuedQuestionIds': [...continuedIds, currentQuestionId],
            },
          },
          { returnDocument: 'after', ...(dbSession ? { session: dbSession } : {}) }
        );
      }

      if (!savedSession) {
        throw new ApiError(409, 'Concurrent state update detected while advancing question');
      }

      const existingCandidateTurn = await InterviewTurn.findOne({
        sessionId: session._id,
        idempotencyKey: turnIdempotencyKey,
      }).lean();

      if (!existingCandidateTurn) {
        const candidateTurnDoc = {
          sessionId: session._id,
          turnNumber: candidateTurnNumber,
          idempotencyKey: turnIdempotencyKey,
          speaker: 'CANDIDATE',
          turnType: 'CANDIDATE_ANSWER',
          stageId: currentQuestion?.stageId || session.currentStageId,
          questionId: currentQuestionId,
          competencyId: currentQuestion?.competencyId || null,
          spokenText: selectedAttempt.answerText,
          rawTranscript: selectedAttempt.answerText,
          transcriptStatus: 'FINAL',
          processingStatus: 'PROCESSED',
          sttMetadata: {
            practiceAttemptId: String(selectedAttempt._id),
            practiceAttemptNumber: selectedAttempt.attemptNumber,
          },
          startedAt: now,
          endedAt: now,
        };
        const [createdTurn] = dbSession
          ? await InterviewTurn.create([candidateTurnDoc], { session: dbSession })
          : [await InterviewTurn.create(candidateTurnDoc)];

        await PracticeAttempt.updateOne(
          { _id: selectedAttempt._id },
          { $set: { turnId: createdTurn._id, isSelectedForEvaluation: true } },
          dbSession ? { session: dbSession } : undefined
        );
      }

      if (!nextQuestion) {
        const evt = {
          eventId: `evt_${crypto.randomUUID()}`,
          sessionId: session._id,
          intakeId: session.intakeId,
          eventType: 'INTERVIEW_SESSION_COMPLETED',
          payload: {
            sessionId: session.sessionId,
            practiceMode: session.practiceMode,
            terminationReason: 'ALL_QUESTIONS_COMPLETED',
          },
          outboxStatus: 'PENDING_DISPATCH',
        };
        if (dbSession) {
          await InterviewEvent.create([evt], { session: dbSession });
        } else {
          await InterviewEvent.create(evt);
        }

        return { completed: true, session: savedSession, nextQuestion: null };
      }

      const nextAiTurnNumber = candidateTurnNumber + 1;
      const nextPromptText = nextQuestion.prompt || nextQuestion.questionText;
      const nextAiTurnDoc = {
        sessionId: session._id,
        turnNumber: nextAiTurnNumber,
        idempotencyKey: `guided_ai_${session._id}_${nextQuestion.questionId}`,
        speaker: 'AI',
        turnType: 'CORE_QUESTION',
        stageId: nextQuestion.stageId,
        questionId: nextQuestion.questionId,
        competencyId: nextQuestion.competencyId || null,
        spokenText: nextPromptText,
        transcriptStatus: 'FINAL',
        processingStatus: 'PROCESSED',
        startedAt: now,
        endedAt: now,
      };

      if (dbSession) {
        await InterviewTurn.create([nextAiTurnDoc], { session: dbSession });
      } else {
        await InterviewTurn.create(nextAiTurnDoc);
      }

      return {
        completed: false,
        session: savedSession,
        nextQuestion: {
          questionId: nextQuestion.questionId,
          stageId: nextQuestion.stageId,
          competencyId: nextQuestion.competencyId || null,
          prompt: nextPromptText,
          learningObjective: getQuestionLearningObjective(nextQuestion, internalBlueprint),
        },
      };
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err && (err.code === 11000 || err.code === 112)) {
      throw new ApiError(409, 'Concurrent state update detected while advancing question');
    }
    throw err;
  }

  return {
    idempotentReplay: false,
    ...updated,
  };
};

module.exports = {
  getQuestionLearningObjective,
  requestHint,
  submitAttempt,
  getFeedback,
  prepareRetry,
  continueToNextQuestion,
};
