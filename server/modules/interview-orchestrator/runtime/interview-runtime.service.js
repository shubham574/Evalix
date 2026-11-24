const crypto = require('crypto');
const mongoose = require('mongoose');
const ApiError = require('../../../utils/ApiError');
const env = require('../../../config/env');
const { withTransaction } = require('../../common/db/transaction');
const { InterviewIntake } = require('../../intake/interviewIntake.model');
const { InterviewBlueprint } = require('../../interview-blueprint/models/interviewBlueprint.model');
const {
  toInternalOrchestratorBlueprint,
} = require('../../interview-blueprint/serializers/blueprint.serializer');
const InterviewSession = require('../session/interviewSession.model');
const InterviewTurn = require('../turns/interviewTurn.model');
const InterviewEvent = require('../events/interviewEvent.model');
const SessionMemory = require('../memory/sessionMemory.model');
const {
  SESSION_STATUSES,
  assertSessionTransition,
  canAcceptTurn,
  isTerminalStatus,
} = require('../session/session-state-machine');
const {
  initializeStageProgress,
  getCurrentStage,
  getNextStage,
  advanceStage,
  isOpeningOrGreetingStage,
} = require('./stage-manager');
const {
  findQuestionById,
  getNextUnaskedQuestion,
  markQuestionAsked,
  markQuestionCompleted,
  incrementFollowUpCount,
  getFollowUpPolicy,
} = require('./question-manager');
const {
  buildFocusedPracticeSnapshot,
  buildFocusedEffectiveBlueprint,
  getEffectiveBlueprintForSession,
} = require('../practice/focused-practice.service');
const {
  getQuestionLearningObjective,
} = require('../practice/guided-practice.service');
const {
  getTimeSnapshot,
  accumulateActiveTime,
  accumulatePausedTime,
} = require('./time-manager');
const {
  initializeSessionMemory,
  getSessionMemory,
  updateSessionMemoryAfterTurn,
} = require('../memory/memory.service');
const { createInterviewerAgent } = require('../conversation/interviewer.agent');
const { createSttAdapter } = require('../voice/stt.adapter');
const { createTtsAdapter } = require('../voice/tts.adapter');
const { recordTtsInterruption } = require('../voice/interruption-handler');
const { CandidateJobAnalysis } = require('../../candidate-intelligence/analysis/candidateJobAnalysis.model');
const { buildCandidateContext } = require('../context/candidate-context-builder');
const { createAnswerClassifier } = require('../conversation/answer-classifier');
const { createTurnDecider } = require('./turn-decision.graph');

const computeBlueprintChecksum = (bp) => {
  const canonical = JSON.stringify({
    blueprintId: String(bp.blueprintId || bp._id),
    blueprintVersion: bp.blueprintVersion,
    stages: bp.stages || [],
    coreQuestions: bp.coreQuestions || [],
    personalisedQuestions: bp.personalisedQuestions || [],
    followUpPolicies: bp.followUpPolicies || [],
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
};

const findSessionByIdentifier = async (sessionIdOrObjectId) => {
  const query = mongoose.isValidObjectId(sessionIdOrObjectId)
    ? { $or: [{ sessionId: sessionIdOrObjectId }, { _id: sessionIdOrObjectId }] }
    : { sessionId: sessionIdOrObjectId };
  return InterviewSession.findOne(query);
};

const concurrencyConflict = (message = 'Interview session was modified concurrently; please retry') =>
  new ApiError(409, message);

/**
 * If a candidate turn with this idempotency key already exists (e.g. a concurrent retry won
 * the race), return the idempotent-replay response for it; otherwise null.
 */
const replayExistingTurn = async (sessionObjectId, idempotencyKey) => {
  const raceTurn = await InterviewTurn.findOne({ sessionId: sessionObjectId, idempotencyKey });
  if (!raceTurn) return null;
  const pairedAiTurn = await InterviewTurn.findOne({
    sessionId: sessionObjectId,
    turnNumber: raceTurn.turnNumber + 1,
    speaker: 'AI',
  });
  const latestSession = await InterviewSession.findById(sessionObjectId);
  return {
    idempotentReplay: true,
    ignored: raceTurn.processingStatus === 'IGNORED',
    session: latestSession,
    candidateTurn: raceTurn,
    aiTurn: pairedAiTurn,
    tts: null,
  };
};

const createInterviewRuntimeService = ({
  llmProvider = null,
  sttProvider = null,
  ttsProvider = null,
  answerClassifier = null,
  turnEngine = env.INTERVIEW_TURN_ENGINE,
} = {}) => {
  const interviewerAgent = createInterviewerAgent({ llmProvider });
  const sttAdapter = createSttAdapter({ sttProvider });
  const ttsAdapter = createTtsAdapter({ ttsProvider });
  const classifier = answerClassifier || createAnswerClassifier({ llmProvider });
  // classify -> interviewer agent -> adaptive policy, as a LangGraph StateGraph (or sequentially)
  const turnDecider = createTurnDecider({ classifier, interviewerAgent, engine: turnEngine });

  const loadAuthorizedSession = async (sessionIdentifier, userId, { bypassOwnership = false } = {}) => {
    const session = await findSessionByIdentifier(sessionIdentifier);
    if (!session) {
      throw new ApiError(404, 'Interview session not found');
    }
    if (!bypassOwnership && session.userId !== userId) {
      throw new ApiError(403, 'Not authorized to access this interview session');
    }
    return session;
  };

  const emitCompletedOutboxEvent = async (session, dbSession = null) => {
    const existing = await InterviewEvent.findOne({
      sessionId: session._id,
      eventType: 'INTERVIEW_SESSION_COMPLETED',
    }).session(dbSession || null);
    if (existing) return existing;

    const payload = {
      sessionId: session.sessionId,
      sessionObjectId: String(session._id),
      intakeId: String(session.intakeId),
      blueprintId: String(session.blueprintId),
      blueprintVersion: session.blueprintVersion,
      candidateProfileId: String(session.candidateProfileId),
      candidateAnalysisId: String(session.candidateAnalysisId),
      interviewType: session.interviewType,
      targetRole: session.targetRole,
      seniorityLevel: session.seniorityLevel,
      totalTurns: session.totalTurnCount,
      askedQuestionIds: session.askedQuestionIds || [],
      completedQuestionIds: session.completedQuestionIds || [],
      coveredCompetencyIds: session.coveredCompetencyIds || [],
      activeDurationSeconds: session.activeDurationSeconds,
      pausedDurationSeconds: session.pausedDurationSeconds,
      completedAt: session.completedAt || new Date(),
      terminationReason: session.terminationReason || 'COMPLETED',
    };

    const doc = {
      eventId: `evt_${crypto.randomUUID()}`,
      sessionId: session._id,
      intakeId: session.intakeId,
      eventType: 'INTERVIEW_SESSION_COMPLETED',
      payload,
      outboxStatus: 'PENDING_DISPATCH',
      occurredAt: new Date(),
    };

    if (dbSession) {
      const created = await InterviewEvent.create([doc], { session: dbSession });
      return created[0];
    }
    return InterviewEvent.create(doc);
  };

  const VALID_PRACTICE_MODES = ['REALISTIC_MOCK', 'GUIDED_PRACTICE', 'FOCUSED_SKILL_PRACTICE'];

  const createSession = async ({
    intakeId,
    userId,
    blueprintId = null,
    practiceMode = 'REALISTIC_MOCK',
    competencyId = null,
    maxQuestions = null,
  }) => {
    if (!VALID_PRACTICE_MODES.includes(practiceMode)) {
      throw new ApiError(400, `Invalid practiceMode '${practiceMode}'`);
    }
    if (!mongoose.isValidObjectId(intakeId)) {
      throw new ApiError(400, 'Invalid intakeId');
    }
    const intake = await InterviewIntake.findById(intakeId);
    if (!intake) {
      throw new ApiError(404, 'Interview intake not found');
    }
    if (intake.userId !== userId) {
      throw new ApiError(403, 'Not authorized to create session for this intake');
    }

    let blueprintDoc = null;
    if (blueprintId) {
      if (!mongoose.isValidObjectId(blueprintId)) {
        throw new ApiError(400, 'Invalid blueprintId');
      }
      blueprintDoc = await InterviewBlueprint.findOne({
        _id: blueprintId,
        intakeId: intake._id,
      });
    } else {
      blueprintDoc = await InterviewBlueprint.findOne({
        intakeId: intake._id,
      }).sort({ blueprintVersion: -1, createdAt: -1 });
    }

    if (!blueprintDoc) {
      throw new ApiError(404, 'Interview blueprint not found for this intake');
    }
    if (blueprintDoc.status !== 'READY') {
      throw new ApiError(
        409,
        `Cannot start interview session: blueprint status is '${blueprintDoc.status}', expected 'READY'`
      );
    }

    const internalBlueprint = toInternalOrchestratorBlueprint(blueprintDoc);
    const blueprintChecksum = computeBlueprintChecksum(internalBlueprint);

    let effectiveBlueprint = internalBlueprint;
    let focusedCompetencyId = null;
    let executionSnapshot = null;
    let guidedState = null;

    if (practiceMode === 'FOCUSED_SKILL_PRACTICE') {
      const focused = buildFocusedPracticeSnapshot({
        internalBlueprint,
        competencyId,
        maxQuestions,
      });
      focusedCompetencyId = focused.executionSnapshot.focusedCompetencyId;
      executionSnapshot = focused.executionSnapshot;
      // Restrict stages AND every question source to the focused snapshot so stage
      // progress and question selection can never reach non-focused questions.
      effectiveBlueprint = buildFocusedEffectiveBlueprint(internalBlueprint, executionSnapshot);
    } else if (practiceMode === 'GUIDED_PRACTICE') {
      executionSnapshot = {
        practiceMode: 'GUIDED_PRACTICE',
        maxHintsPerQuestion: env.GUIDED_PRACTICE_MAX_HINTS,
        maxAttemptsPerQuestion: env.GUIDED_PRACTICE_MAX_ATTEMPTS,
        createdAt: new Date().toISOString(),
      };
      guidedState = {
        currentQuestionId: null,
        currentAttemptCount: 0,
        hintsUsedForCurrentQuestion: 0,
        awaitingContinue: false,
        selectedAttemptIdByQuestion: {},
        continuedQuestionIds: [],
      };
    }

    const stageProgress = initializeStageProgress(effectiveBlueprint);
    const firstStage = stageProgress[0] || null;
    const sessionId = `sess_${crypto.randomUUID()}`;

    const createdSession = await withTransaction(async (dbSession) => {
      // Lock the blueprint for session immutability
      await InterviewBlueprint.updateOne(
        { _id: blueprintDoc._id },
        { $set: { isLockedForSession: true } },
        dbSession ? { session: dbSession } : undefined
      );

      const sessionDoc = {
        sessionId,
        userId,
        intakeId: intake._id,
        candidateProfileId: blueprintDoc.candidateProfileId,
        candidateAnalysisId: blueprintDoc.candidateAnalysisId,
        blueprintId: blueprintDoc._id,
        blueprintVersion: blueprintDoc.blueprintVersion,
        blueprintChecksum,
        interviewType: effectiveBlueprint.interviewType || intake.interviewType || 'MIXED',
        practiceMode,
        focusedCompetencyId,
        executionSnapshot,
        guidedState,
        targetRole: effectiveBlueprint.targetRole || intake.targetRole || 'Software Engineer',
        seniorityLevel: effectiveBlueprint.seniorityLevel || intake.seniorityLevel || 'MID',
        status: SESSION_STATUSES.READY,
        stateVersion: 0,
        consentRequired: env.INTERVIEW_ORCHESTRATOR_REQUIRE_CONSENT,
        consentGranted: false,
        currentStageId: firstStage?.stageId || null,
        currentStageIndex: 0,
        stageProgress,
        totalDurationSeconds: effectiveBlueprint.totalDurationSeconds || 2700,
      };

      const [session] = dbSession
        ? await InterviewSession.create([sessionDoc], { session: dbSession })
        : [await InterviewSession.create(sessionDoc)];

      await initializeSessionMemory(session, effectiveBlueprint, dbSession);

      const events = [
        {
          eventId: `evt_${crypto.randomUUID()}`,
          sessionId: session._id,
          intakeId: intake._id,
          eventType: 'SESSION_CREATED',
          payload: { sessionId, blueprintId: String(blueprintDoc._id), blueprintVersion: blueprintDoc.blueprintVersion },
          outboxStatus: 'INTERNAL',
        },
        {
          eventId: `evt_${crypto.randomUUID()}`,
          sessionId: session._id,
          intakeId: intake._id,
          eventType: 'SESSION_READY',
          payload: { sessionId, blueprintChecksum },
          outboxStatus: 'INTERNAL',
        },
      ];

      if (dbSession) {
        await InterviewEvent.create(events, { session: dbSession, ordered: true });
      } else {
        await InterviewEvent.create(events);
      }

      return session;
    });

    return createdSession;
  };

  const startSession = async ({ sessionId, userId, consentGranted = false }) => {
    const session = await loadAuthorizedSession(sessionId, userId);

    if (session.status === SESSION_STATUSES.IN_PROGRESS) {
      const existingTurn = await InterviewTurn.findOne({
        sessionId: session._id,
        turnNumber: session.lastCompletedTurnNumber || 1,
      });
      return { session, openingTurn: existingTurn, tts: null };
    }

    if (session.status === SESSION_STATUSES.PAUSED) {
      throw new ApiError(
        409,
        'Interview session is paused; use /resume to continue it instead of /start'
      );
    }
    // Only a session that has never started may be started (READY / CREATED).
    if (![SESSION_STATUSES.READY, SESSION_STATUSES.CREATED].includes(session.status)) {
      throw new ApiError(
        409,
        `Cannot start interview session while in status '${session.status}'`
      );
    }
    assertSessionTransition(session.status, SESSION_STATUSES.IN_PROGRESS);
    const loadedStatus = session.status;
    const loadedVersion = Number(session.stateVersion) || 0;

    if (session.consentRequired && consentGranted !== true) {
      throw new ApiError(
        400,
        'Candidate consent is required before starting the live interview session'
      );
    }

    const blueprintDoc = await InterviewBlueprint.findById(session.blueprintId);
    if (!blueprintDoc) {
      throw new ApiError(404, 'Associated interview blueprint not found');
    }
    const rawInternalBlueprint = toInternalOrchestratorBlueprint(blueprintDoc);
    const internalBlueprint = getEffectiveBlueprintForSession(session, rawInternalBlueprint);
    const now = new Date();

    const currentStage = getCurrentStage(session);
    const firstQuestion = currentStage
      ? getNextUnaskedQuestion(session, internalBlueprint, currentStage.stageId)
      : internalBlueprint.questionPlan?.[0] || null;

    let openingText = `Welcome to your ${session.targetRole} interview! Please take a comfortable breath — there is zero rush today. Let's begin with our opening: `;
    let turnType = 'OPENING';
    if (session.practiceMode === 'GUIDED_PRACTICE' && firstQuestion) {
      const objective = getQuestionLearningObjective(firstQuestion, internalBlueprint);
      openingText = `Welcome to Guided Practice for ${session.targetRole}. Learning objective: ${objective} Question: ${
        firstQuestion.prompt || firstQuestion.questionText
      }`;
      turnType = 'CORE_QUESTION';
    } else if (firstQuestion && !isOpeningOrGreetingStage(currentStage)) {
      openingText = `Welcome to your ${session.targetRole} interview! Let's begin with your first question: ${
        firstQuestion.prompt || firstQuestion.questionText
      }`;
      turnType = 'CORE_QUESTION';
    } else if (firstQuestion) {
      openingText += firstQuestion.prompt || firstQuestion.questionText;
      turnType = 'OPENING';
    } else {
      openingText += 'Could you briefly introduce yourself and share what excites you about this role?';
    }

    const ttsResult = await ttsAdapter.synthesizeSpeech({ text: openingText });

    // Apply in-memory state once, outside the transaction callback, so a transient-error
    // retry of the callback cannot double-apply it (e.g. stateVersion += 1 twice).
    session.status = SESSION_STATUSES.IN_PROGRESS;
    session.consentGranted = Boolean(consentGranted || !session.consentRequired);
    session.consentRecordedAt = now;
    session.startedAt = now;
    session.lastActivityAt = now;
    session.totalTurnCount = 1;
    session.lastCompletedTurnNumber = 1;
    session.stateVersion = loadedVersion + 1;

    if (firstQuestion) {
      markQuestionAsked(session, firstQuestion);
    }

    if (session.practiceMode === 'GUIDED_PRACTICE') {
      session.guidedState = {
        ...(session.guidedState || {}),
        currentQuestionId: firstQuestion?.questionId || null,
        currentAttemptCount: 0,
        hintsUsedForCurrentQuestion: 0,
        awaitingContinue: false,
        selectedAttemptIdByQuestion: session.guidedState?.selectedAttemptIdByQuestion || {},
        continuedQuestionIds: session.guidedState?.continuedQuestionIds || [],
      };
    }

    session.activePrompt = {
      turnNumber: 1,
      stageId: currentStage?.stageId || null,
      questionId: firstQuestion?.questionId || null,
      competencyId: firstQuestion?.competencyId || null,
      isFollowUp: false,
      text: openingText,
      startedAt: now,
    };

    const updatedSession = await withTransaction(async (dbSession) => {
      // Conditional on the loaded status/version: a concurrent /start (double click) or any
      // other transition makes this miss and yields a clean 409 instead of an E11000.
      const savedStartSession = await InterviewSession.findOneAndUpdate(
        { _id: session._id, status: loadedStatus, stateVersion: loadedVersion },
        {
          $set: {
            status: SESSION_STATUSES.IN_PROGRESS,
            consentGranted: session.consentGranted,
            consentRecordedAt: session.consentRecordedAt,
            startedAt: session.startedAt,
            lastActivityAt: session.lastActivityAt,
            totalTurnCount: session.totalTurnCount,
            lastCompletedTurnNumber: session.lastCompletedTurnNumber,
            stateVersion: session.stateVersion,
            askedQuestionIds: session.askedQuestionIds,
            coveredCompetencyIds: session.coveredCompetencyIds,
            currentQuestionId: session.currentQuestionId,
            currentQuestionIndex: session.currentQuestionIndex,
            currentFollowUpCount: session.currentFollowUpCount,
            stageProgress: session.stageProgress,
            activePrompt: session.activePrompt,
            ...(session.guidedState ? { guidedState: session.guidedState } : {}),
          },
        },
        { returnDocument: 'after', session: dbSession || undefined }
      );
      if (!savedStartSession) {
        throw concurrencyConflict(
          'Interview session was already started or modified concurrently'
        );
      }

      const turnDoc = {
        sessionId: session._id,
        turnNumber: 1,
        idempotencyKey: `opening-${session.sessionId}`,
        speaker: 'AI',
        turnType,
        stageId: currentStage?.stageId || null,
        questionId: firstQuestion?.questionId || null,
        competencyId: firstQuestion?.competencyId || null,
        spokenText: openingText,
        transcriptStatus: 'NONE',
        processingStatus: ttsResult.ok ? 'COMPLETED' : 'TTS_FAILED',
        ttsMetadata: ttsResult.metadata,
        startedAt: now,
        endedAt: now,
      };

      const [openingTurn] = dbSession
        ? await InterviewTurn.create([turnDoc], { session: dbSession })
        : [await InterviewTurn.create(turnDoc)];

      await updateSessionMemoryAfterTurn(
        session._id,
        {
          turnNumber: 1,
          speaker: 'AI',
          questionId: firstQuestion?.questionId || null,
          competencyId: firstQuestion?.competencyId || null,
          spokenText: openingText,
          isCoreQuestion: Boolean(firstQuestion),
        },
        dbSession
      );

      const events = [
        {
          eventId: `evt_${crypto.randomUUID()}`,
          sessionId: session._id,
          intakeId: session.intakeId,
          eventType: 'SESSION_STARTED',
          payload: { sessionId: session.sessionId, stageId: currentStage?.stageId || null },
          outboxStatus: 'INTERNAL',
        },
        {
          eventId: `evt_${crypto.randomUUID()}`,
          sessionId: session._id,
          intakeId: session.intakeId,
          eventType: 'CONSENT_RECORDED',
          payload: { consentGranted: session.consentGranted, recordedAt: now },
          outboxStatus: 'INTERNAL',
        },
      ];

      if (ttsResult && !ttsResult.ok) {
        events.push({
          eventId: `evt_${crypto.randomUUID()}`,
          sessionId: session._id,
          intakeId: session.intakeId,
          eventType: 'TTS_FAILED',
          payload: { turnNumber: 1, error: ttsResult.error },
          outboxStatus: 'INTERNAL',
        });
      }

      if (dbSession) {
        await InterviewEvent.create(events, { session: dbSession, ordered: true });
      } else {
        await InterviewEvent.create(events);
      }

      return { session: savedStartSession, openingTurn };
    });

    return {
      session: updatedSession.session,
      openingTurn: updatedSession.openingTurn,
      tts: ttsResult,
    };
  };

  const pauseSession = async ({ sessionId, userId, reason = 'CANDIDATE_REQUESTED' }) => {
    const session = await loadAuthorizedSession(sessionId, userId);
    assertSessionTransition(session.status, SESSION_STATUSES.PAUSED);
    const now = new Date();
    const loadedStatus = session.status;
    const loadedVersion = Number(session.stateVersion) || 0;

    accumulateActiveTime(session, now);
    // Conditional write: a concurrent turn/end that changed status or stateVersion makes
    // this miss (409) instead of silently overwriting e.g. a COMPLETED session.
    const updated = await InterviewSession.findOneAndUpdate(
      { _id: session._id, status: loadedStatus, stateVersion: loadedVersion },
      {
        $set: {
          status: SESSION_STATUSES.PAUSED,
          pausedAt: now,
          lastActivityAt: now,
          activeDurationSeconds: session.activeDurationSeconds,
          stageProgress: session.stageProgress,
        },
        $inc: { stateVersion: 1 },
      },
      { returnDocument: 'after' }
    );
    if (!updated) {
      throw concurrencyConflict();
    }

    await InterviewEvent.create({
      eventId: `evt_${crypto.randomUUID()}`,
      sessionId: session._id,
      intakeId: session.intakeId,
      eventType: 'SESSION_PAUSED',
      payload: { reason, pausedAt: now },
      outboxStatus: 'INTERNAL',
    });

    return updated;
  };

  const resumeSession = async ({ sessionId, userId }) => {
    const session = await loadAuthorizedSession(sessionId, userId);
    // Only a PAUSED session can be resumed. READY -> IN_PROGRESS must go through /start,
    // which enforces consent and creates the opening turn.
    if (session.status !== SESSION_STATUSES.PAUSED) {
      throw new ApiError(
        409,
        `Cannot resume interview session while in status '${session.status}'; only PAUSED sessions can be resumed`
      );
    }
    const now = new Date();
    const loadedVersion = Number(session.stateVersion) || 0;

    accumulatePausedTime(session, now);
    const updated = await InterviewSession.findOneAndUpdate(
      { _id: session._id, status: SESSION_STATUSES.PAUSED, stateVersion: loadedVersion },
      {
        $set: {
          status: SESSION_STATUSES.IN_PROGRESS,
          pausedAt: null,
          lastActivityAt: now,
          pausedDurationSeconds: session.pausedDurationSeconds,
        },
        $inc: { stateVersion: 1 },
      },
      { returnDocument: 'after' }
    );
    if (!updated) {
      throw concurrencyConflict();
    }

    await InterviewEvent.create({
      eventId: `evt_${crypto.randomUUID()}`,
      sessionId: session._id,
      intakeId: session.intakeId,
      eventType: 'SESSION_RESUMED',
      payload: { resumedAt: now, pausedDurationSeconds: updated.pausedDurationSeconds },
      outboxStatus: 'INTERNAL',
    });

    return updated;
  };

  const getTerminalEndResult = async (terminalSession) => {
    const completedEvent = await InterviewEvent.findOne({
      sessionId: terminalSession._id,
      eventType: 'INTERVIEW_SESSION_COMPLETED',
    });
    return { session: terminalSession, completedEvent };
  };

  const endSession = async ({
    sessionId,
    userId,
    reason = 'CANDIDATE_ENDED',
    abandon = false,
    bypassOwnership = false,
  }) => {
    const session = await loadAuthorizedSession(sessionId, userId, { bypassOwnership });

    // GUIDED_PRACTICE sessions may also be ended or abandoned explicitly.
    if (isTerminalStatus(session.status)) {
      return getTerminalEndResult(session);
    }

    const targetStatus = abandon ? SESSION_STATUSES.ABANDONED : SESSION_STATUSES.COMPLETED;
    assertSessionTransition(session.status, targetStatus);
    const now = new Date();
    const loadedStatus = session.status;
    const loadedVersion = Number(session.stateVersion) || 0;

    // In-memory time accounting happens once, outside the (retryable) transaction callback.
    if (loadedStatus === SESSION_STATUSES.IN_PROGRESS) {
      accumulateActiveTime(session, now);
    } else if (loadedStatus === SESSION_STATUSES.PAUSED) {
      accumulatePausedTime(session, now);
    }

    const setFields = {
      status: targetStatus,
      terminationReason: reason,
      lastActivityAt: now,
      activeDurationSeconds: session.activeDurationSeconds,
      pausedDurationSeconds: session.pausedDurationSeconds,
      stageProgress: session.stageProgress,
      pausedAt: null,
      ...(abandon ? { abandonedAt: now } : { completedAt: now }),
    };

    try {
      return await withTransaction(async (dbSession) => {
        const saved = await InterviewSession.findOneAndUpdate(
          { _id: session._id, status: loadedStatus, stateVersion: loadedVersion },
          { $set: setFields, $inc: { stateVersion: 1 } },
          { returnDocument: 'after', session: dbSession || undefined }
        );
        if (!saved) {
          throw concurrencyConflict();
        }

        let completedEvent = null;
        if (abandon) {
          const evtDoc = {
            eventId: `evt_${crypto.randomUUID()}`,
            sessionId: session._id,
            intakeId: session.intakeId,
            eventType: 'SESSION_ABANDONED',
            payload: { reason, abandonedAt: now },
            outboxStatus: 'INTERNAL',
          };
          if (dbSession) {
            await InterviewEvent.create([evtDoc], { session: dbSession });
          } else {
            await InterviewEvent.create(evtDoc);
          }
        } else {
          completedEvent = await emitCompletedOutboxEvent(saved, dbSession);
        }

        return { session: saved, completedEvent };
      });
    } catch (err) {
      // Lost the race to a concurrent transition. If that left the session terminal (e.g. the
      // final turn completed it), report the terminal state instead of re-entering it.
      if (err?.statusCode === 409) {
        const latest = await InterviewSession.findById(session._id);
        if (latest && isTerminalStatus(latest.status)) {
          return getTerminalEndResult(latest);
        }
      }
      throw err;
    }
  };

  const processTurn = async ({
    sessionId,
    userId = null,
    idempotencyKey,
    transcriptText = '',
    audioBuffer = null,
    mimeType = 'audio/webm',
    filename = 'audio.webm',
    transcriptStatus = 'FINAL',
    confidence = null,
    bypassOwnership = false,
    expectedStateVersion = null,
  }) => {
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new ApiError(400, 'idempotencyKey is required for turn submission');
    }

    const session = await loadAuthorizedSession(sessionId, userId, { bypassOwnership });

    if (session.practiceMode === 'GUIDED_PRACTICE') {
      throw new ApiError(
        409,
        'Guided practice sessions do not use live turn submission; use /attempts, /hint, /retry, and /continue'
      );
    }

    // Idempotency check BEFORE status guard so retries of the final turn succeed cleanly
    const existingCandidateTurn = await InterviewTurn.findOne({
      sessionId: session._id,
      idempotencyKey,
    });
    if (existingCandidateTurn) {
      const pairedAiTurn = await InterviewTurn.findOne({
        sessionId: session._id,
        turnNumber: existingCandidateTurn.turnNumber + 1,
        speaker: 'AI',
      });
      return {
        idempotentReplay: true,
        ignored: existingCandidateTurn.processingStatus === 'IGNORED',
        session,
        candidateTurn: existingCandidateTurn,
        aiTurn: pairedAiTurn,
        tts: null,
      };
    }

    if (!canAcceptTurn(session.status)) {
      throw new ApiError(
        409,
        `Session cannot accept turns while in status '${session.status}'`
      );
    }
    if (!canAcceptTurn(session.status, session)) {
      throw new ApiError(
        409,
        'Session cannot accept turns before candidate consent is recorded; start the session with consent first'
      );
    }

    if (
      expectedStateVersion !== null &&
      expectedStateVersion !== undefined &&
      Number(expectedStateVersion) !== session.stateVersion
    ) {
      throw new ApiError(409, 'Optimistic concurrency conflict: session stateVersion mismatch');
    }

    const sttResult = await sttAdapter.resolveCandidateInput({
      audioBuffer,
      mimeType,
      filename,
      transcriptText,
      transcriptStatus,
      confidence,
    });

    // Partial STT transcripts must NEVER trigger LLM decisions or advance interview state
    if (sttResult.ignoredForDecision) {
      return {
        idempotentReplay: false,
        ignored: true,
        reason: sttResult.reason,
        session,
        candidateTurn: null,
        aiTurn: null,
        tts: null,
      };
    }

    const now = new Date();
    const expectedVersion = session.stateVersion;

    // Empty / silent transcript handling: gentle clarification without advancing core question count
    if (sttResult.emptyTranscript) {
      const candidateTurnNumber = session.totalTurnCount + 1;
      const aiTurnNumber = session.totalTurnCount + 2;
      const clarifyText =
        'I did not catch that clearly — could you please repeat your response when you are ready?';

      const ttsResult = await ttsAdapter.synthesizeSpeech({ text: clarifyText });

      // Credit the time spent before this (silent) submission, and point activePrompt at the
      // clarification turn so a barge-in during its TTS targets the right AI turn.
      accumulateActiveTime(session, now);
      const clarifyPrompt = {
        turnNumber: aiTurnNumber,
        stageId: session.currentStageId,
        questionId: session.currentQuestionId,
        competencyId: session.activePrompt?.competencyId || null,
        isFollowUp: Boolean(session.activePrompt?.isFollowUp),
        text: clarifyText,
        startedAt: now,
      };

      const emptyTurnDocs = [
        {
          sessionId: session._id,
          turnNumber: candidateTurnNumber,
          idempotencyKey,
          speaker: 'CANDIDATE',
          turnType: 'CANDIDATE_ANSWER',
          stageId: session.currentStageId,
          questionId: session.currentQuestionId,
          spokenText: '',
          rawTranscript: '',
          transcriptStatus: 'EMPTY',
          processingStatus: 'PROCESSED',
          sttMetadata: sttResult.metadata,
          startedAt: now,
          endedAt: now,
        },
        {
          sessionId: session._id,
          turnNumber: aiTurnNumber,
          idempotencyKey: `${idempotencyKey}:ai`,
          speaker: 'AI',
          turnType: 'CLARIFICATION',
          stageId: session.currentStageId,
          questionId: session.currentQuestionId,
          spokenText: clarifyText,
          transcriptStatus: 'NONE',
          processingStatus: ttsResult.ok ? 'COMPLETED' : 'TTS_FAILED',
          ttsMetadata: ttsResult.metadata,
          startedAt: now,
          endedAt: now,
        },
      ];

      // Session update + both turns commit atomically, so a failed turn insert can never
      // leave totalTurnCount advanced without turns (turn-number gap).
      let emptyResult;
      try {
        emptyResult = await withTransaction(async (dbSession) => {
          const updatedSession = await InterviewSession.findOneAndUpdate(
            { _id: session._id, stateVersion: expectedVersion },
            {
              $set: {
                lastActivityAt: now,
                totalTurnCount: aiTurnNumber,
                lastCompletedTurnNumber: aiTurnNumber,
                activeDurationSeconds: session.activeDurationSeconds,
                stageProgress: session.stageProgress,
                activePrompt: clarifyPrompt,
              },
              $inc: { stateVersion: 1 },
            },
            { returnDocument: 'after', session: dbSession || undefined }
          );
          if (!updatedSession) {
            throw concurrencyConflict('Concurrent turn modification detected');
          }

          const created = dbSession
            ? await InterviewTurn.create(emptyTurnDocs, { session: dbSession, ordered: true })
            : await InterviewTurn.create(emptyTurnDocs);

          return { updatedSession, candTurn: created[0], aiTurn: created[1] };
        });
      } catch (err) {
        // A concurrent retry with the same idempotencyKey won the race: replay its result.
        if (err?.code === 11000 || err?.statusCode === 409) {
          const replay = await replayExistingTurn(session._id, idempotencyKey);
          if (replay) return replay;
        }
        throw err;
      }

      return {
        idempotentReplay: false,
        ignored: false,
        emptyTranscript: true,
        session: emptyResult.updatedSession,
        candidateTurn: emptyResult.candTurn,
        aiTurn: emptyResult.aiTurn,
        tts: ttsResult,
      };
    }

    const blueprintDoc = await InterviewBlueprint.findById(session.blueprintId);
    if (!blueprintDoc) {
      throw new ApiError(404, 'Interview blueprint not found');
    }
    const rawInternalBlueprint = toInternalOrchestratorBlueprint(blueprintDoc);
    const internalBlueprint = getEffectiveBlueprintForSession(session, rawInternalBlueprint);
    const memory = await getSessionMemory(session._id);

    const currentStage = getCurrentStage(session);
    const currentQuestion = findQuestionById(internalBlueprint, session.currentQuestionId);
    const nextQuestionCandidate = currentStage
      ? getNextUnaskedQuestion(session, internalBlueprint, currentStage.stageId)
      : null;
    const nextStageInfo = getNextStage(session);
    const nextStageCandidate = nextStageInfo?.stage || null;
    const followUpPolicy = getFollowUpPolicy(internalBlueprint, currentQuestion?.questionId);
    const timeSnapshot = getTimeSnapshot(session, now);

    // Load candidate intelligence analysis snapshot for contextual grounding
    let analysisDoc = null;
    if (session.candidateAnalysisId) {
      analysisDoc = await CandidateJobAnalysis.findById(session.candidateAnalysisId).lean();
    }
    if (!analysisDoc && session.intakeId) {
      analysisDoc = await CandidateJobAnalysis.findOne({ intakeId: session.intakeId }).lean();
    }
    const candidateContext = buildCandidateContext({ session, internalBlueprint, analysisDoc });

    // Per-turn decision (outside any DB transaction): classify the answer, ask the interviewer
    // agent for a proposal (skipped when policy would discard it), then validate / fall back.
    const { classification, agentResult, resolved } = await turnDecider.decide({
      blueprint: internalBlueprint,
      session,
      memory,
      currentStage,
      currentQuestion,
      nextQuestionCandidate,
      nextStageCandidate,
      followUpPolicy,
      timeSnapshot,
      candidateTranscript: sttResult.transcript,
      candidateContext,
      requestId: idempotencyKey,
    });

    if (classification?.intent === 'REQUEST_SKIP' && currentQuestion) {
      session.skippedQuestionIds = session.skippedQuestionIds || [];
      if (!session.skippedQuestionIds.includes(currentQuestion.questionId)) {
        session.skippedQuestionIds.push(currentQuestion.questionId);
      }
    }

    // Apply deterministic state updates in memory, then persist with optimistic concurrency lock
    accumulateActiveTime(session, now);
    session.lastActivityAt = now;

    const candidateTurnNumber = session.totalTurnCount + 1;
    const aiTurnNumber = session.totalTurnCount + 2;
    let aiTurnType = 'CORE_QUESTION';
    let nextActiveQuestion = currentQuestion;
    let nextActiveStageId = session.currentStageId;
    let isFollowUp = false;
    let isNewCoreQuestion = false;
    let stageTransitioned = false;
    let sessionWillComplete = false;

    if (resolved.action === 'ASK_FOLLOW_UP' && currentQuestion) {
      aiTurnType = 'FOLLOW_UP';
      isFollowUp = true;
      incrementFollowUpCount(session, currentQuestion.questionId);
    } else if (resolved.action === 'CLARIFY_OR_REPEAT' || resolved.action === 'PAUSE_FOR_THINKING') {
      aiTurnType = 'CLARIFICATION';
    } else if (resolved.action === 'MOVE_NEXT_QUESTION' && nextQuestionCandidate) {
      if (currentQuestion) {
        markQuestionCompleted(session, currentQuestion.questionId);
      }
      markQuestionAsked(session, nextQuestionCandidate);
      nextActiveQuestion = nextQuestionCandidate;
      aiTurnType = 'CORE_QUESTION';
      isNewCoreQuestion = true;
    } else if (resolved.action === 'ADVANCE_STAGE') {
      if (currentQuestion) {
        markQuestionCompleted(session, currentQuestion.questionId);
      }
      const adv = advanceStage(session, now);
      if (adv.allStagesCompleted) {
        aiTurnType = 'CLOSING';
        sessionWillComplete = true;
      } else {
        stageTransitioned = true;
        nextActiveStageId = adv.nextStage.stageId;
        const firstInNext = getNextUnaskedQuestion(session, internalBlueprint, nextActiveStageId);
        if (firstInNext) {
          markQuestionAsked(session, firstInNext);
          nextActiveQuestion = firstInNext;
          aiTurnType = 'CORE_QUESTION';
          isNewCoreQuestion = true;
          // Ensure prompt is spoken so the AI does not announce a stage silently
          const spoken = String(resolved.spokenResponse || '').trim();
          const firstPrompt = String(firstInNext.prompt || firstInNext.questionText || '').trim();
          if (firstPrompt && !spoken.toLowerCase().includes(firstPrompt.toLowerCase().slice(0, 30))) {
            resolved.spokenResponse = `${spoken} ${firstPrompt}`.trim();
          }
        } else {
          nextActiveQuestion = null;
          aiTurnType = 'TRANSITION';
        }
      }
    } else if (resolved.action === 'WRAP_UP_INTERVIEW') {
      if (currentQuestion) {
        markQuestionCompleted(session, currentQuestion.questionId);
      }
      aiTurnType = 'CLOSING';
      sessionWillComplete = true;
    }

    // Synthesize TTS before final DB write so we know TTS outcome without holding DB locks
    const ttsResult = await ttsAdapter.synthesizeSpeech({ text: resolved.spokenResponse });

    session.totalTurnCount = aiTurnNumber;
    session.lastCompletedTurnNumber = aiTurnNumber;
    session.activePrompt = {
      turnNumber: aiTurnNumber,
      stageId: nextActiveStageId,
      questionId: nextActiveQuestion?.questionId || null,
      competencyId: nextActiveQuestion?.competencyId || null,
      isFollowUp,
      text: resolved.spokenResponse,
      startedAt: now,
    };

    if (sessionWillComplete) {
      session.status = SESSION_STATUSES.COMPLETED;
      session.completedAt = now;
      session.terminationReason =
        timeSnapshot.timeMode === 'TIME_EXPIRED' ? 'TIME_EXPIRED' : 'COMPLETED';
    }

    let transactionResult;
    try {
      transactionResult = await withTransaction(async (dbSession) => {
        const updateFields = {
        status: session.status,
        currentStageId: session.currentStageId,
        currentStageIndex: session.currentStageIndex,
        currentQuestionId: session.currentQuestionId,
        currentQuestionIndex: session.currentQuestionIndex,
        currentFollowUpCount: session.currentFollowUpCount,
        totalTurnCount: session.totalTurnCount,
        lastCompletedTurnNumber: session.lastCompletedTurnNumber,
        stageProgress: session.stageProgress,
        askedQuestionIds: session.askedQuestionIds,
        completedQuestionIds: session.completedQuestionIds,
        skippedQuestionIds: session.skippedQuestionIds || [],
        coveredCompetencyIds: session.coveredCompetencyIds,
        followUpsPerQuestion: session.followUpsPerQuestion,
        activePrompt: session.activePrompt,
        activeDurationSeconds: session.activeDurationSeconds,
        lastActivityAt: session.lastActivityAt,
        completedAt: session.completedAt,
        terminationReason: session.terminationReason,
      };

      const lockedSession = await InterviewSession.findOneAndUpdate(
        { _id: session._id, stateVersion: expectedVersion },
        { $set: updateFields, $inc: { stateVersion: 1 } },
        { returnDocument: 'after', session: dbSession || undefined }
      );

      if (!lockedSession) {
        const raceTurn = await InterviewTurn.findOne({
          sessionId: session._id,
          idempotencyKey,
        });
        if (raceTurn) {
          const pairedAiTurn = await InterviewTurn.findOne({
            sessionId: session._id,
            turnNumber: raceTurn.turnNumber + 1,
            speaker: 'AI',
          });
          const latestSession = await InterviewSession.findById(session._id);
          return {
            savedSession: latestSession,
            candTurn: raceTurn,
            aiTurn: pairedAiTurn,
            isIdempotentRace: true,
          };
        }
        throw new ApiError(409, 'Optimistic concurrency conflict: session was modified concurrently');
      }

      const turnsToCreate = [
        {
          sessionId: session._id,
          turnNumber: candidateTurnNumber,
          idempotencyKey,
          speaker: 'CANDIDATE',
          turnType: 'CANDIDATE_ANSWER',
          stageId: currentStage?.stageId || null,
          questionId: currentQuestion?.questionId || null,
          competencyId: currentQuestion?.competencyId || null,
          spokenText: sttResult.transcript,
          rawTranscript: sttResult.transcript,
          transcriptStatus: sttResult.transcriptStatus,
          processingStatus: 'PROCESSED',
          sttMetadata: {
            ...(sttResult.metadata || {}),
            classification,
          },
          startedAt: now,
          endedAt: now,
        },
        {
          sessionId: session._id,
          turnNumber: aiTurnNumber,
          idempotencyKey: `${idempotencyKey}:ai`,
          speaker: 'AI',
          turnType: aiTurnType,
          stageId: nextActiveStageId,
          questionId: nextActiveQuestion?.questionId || null,
          competencyId: nextActiveQuestion?.competencyId || null,
          spokenText: resolved.spokenResponse,
          transcriptStatus: 'NONE',
          processingStatus: ttsResult.ok ? 'COMPLETED' : 'TTS_FAILED',
          ttsMetadata: ttsResult.metadata,
          adaptiveDecision: {
            action: resolved.action,
            followUpType: resolved.followUpType,
            reason: resolved.reasoning,
            policyValidated: resolved.policyValidated,
            fallbackUsed: resolved.fallbackUsed,
            validationWarnings: resolved.validationWarnings || [],
            classification,
          },
          llmMetadata: agentResult.llmMetadata,
          startedAt: now,
          endedAt: now,
        },
      ];

      const createdTurns = dbSession
        ? await InterviewTurn.create(turnsToCreate, { session: dbSession, ordered: true })
        : await InterviewTurn.create(turnsToCreate);

      await updateSessionMemoryAfterTurn(
        session._id,
        {
          turnNumber: candidateTurnNumber,
          speaker: 'CANDIDATE',
          questionId: currentQuestion?.questionId || null,
          competencyId: currentQuestion?.competencyId || null,
          spokenText: sttResult.transcript,
          extractedClaims: resolved.candidateClaims,
          topicsMentioned: resolved.topicsMentioned,
          observedSignals: resolved.observedSignals,
        },
        dbSession
      );

      await updateSessionMemoryAfterTurn(
        session._id,
        {
          turnNumber: aiTurnNumber,
          speaker: 'AI',
          questionId: nextActiveQuestion?.questionId || null,
          competencyId: nextActiveQuestion?.competencyId || null,
          spokenText: resolved.spokenResponse,
          isFollowUp,
          isCoreQuestion: isNewCoreQuestion,
        },
        dbSession
      );

      const eventsToCreate = [
        {
          eventId: `evt_${crypto.randomUUID()}`,
          sessionId: session._id,
          intakeId: session.intakeId,
          eventType: 'TURN_PROCESSED',
          payload: {
            candidateTurnNumber,
            aiTurnNumber,
            action: resolved.action,
            fallbackUsed: resolved.fallbackUsed,
          },
          outboxStatus: 'INTERNAL',
        },
      ];

      if (isFollowUp) {
        eventsToCreate.push({
          eventId: `evt_${crypto.randomUUID()}`,
          sessionId: session._id,
          intakeId: session.intakeId,
          eventType: 'FOLLOW_UP_ASKED',
          payload: {
            questionId: currentQuestion?.questionId,
            followUpType: resolved.followUpType,
            followUpCount: session.currentFollowUpCount,
          },
          outboxStatus: 'INTERNAL',
        });
      }

      if (stageTransitioned) {
        eventsToCreate.push({
          eventId: `evt_${crypto.randomUUID()}`,
          sessionId: session._id,
          intakeId: session.intakeId,
          eventType: 'STAGE_TRANSITIONED',
          payload: { nextStageId: nextActiveStageId },
          outboxStatus: 'INTERNAL',
        });
      }

      if (!ttsResult.ok) {
        eventsToCreate.push({
          eventId: `evt_${crypto.randomUUID()}`,
          sessionId: session._id,
          intakeId: session.intakeId,
          eventType: 'TTS_FAILED',
          payload: { turnNumber: aiTurnNumber, error: ttsResult.error },
          outboxStatus: 'INTERNAL',
        });
      }

      if (dbSession) {
        await InterviewEvent.create(eventsToCreate, { session: dbSession, ordered: true });
      } else {
        await InterviewEvent.create(eventsToCreate);
      }

      if (sessionWillComplete) {
        await emitCompletedOutboxEvent(lockedSession, dbSession);
      }

      return {
        savedSession: lockedSession,
        candTurn: createdTurns[0],
        aiTurn: createdTurns[1],
      };
    });
    } catch (err) {
      if (err.code === 11000 || err.statusCode === 409) {
        const raceTurn = await InterviewTurn.findOne({
          sessionId: session._id,
          idempotencyKey,
        });
        if (raceTurn) {
          const pairedAiTurn = await InterviewTurn.findOne({
            sessionId: session._id,
            turnNumber: raceTurn.turnNumber + 1,
            speaker: 'AI',
          });
          const latestSession = await InterviewSession.findById(session._id);
          return {
            idempotentReplay: true,
            ignored: raceTurn.processingStatus === 'IGNORED',
            session: latestSession,
            candidateTurn: raceTurn,
            aiTurn: pairedAiTurn,
            tts: null,
          };
        }
      }
      throw err;
    }

    if (transactionResult.isIdempotentRace) {
      return {
        idempotentReplay: true,
        ignored: transactionResult.candTurn.processingStatus === 'IGNORED',
        session: transactionResult.savedSession,
        candidateTurn: transactionResult.candTurn,
        aiTurn: transactionResult.aiTurn,
        tts: null,
      };
    }

    return {
      idempotentReplay: false,
      ignored: false,
      session: transactionResult.savedSession,
      candidateTurn: transactionResult.candTurn,
      aiTurn: transactionResult.aiTurn,
      tts: ttsResult,
    };
  };

  const retryTurnTts = async ({ sessionId, turnId }) => {
    const session = await loadAuthorizedSession(sessionId, null, { bypassOwnership: true });
    const turnQuery = mongoose.isValidObjectId(turnId)
      ? { _id: turnId, sessionId: session._id }
      : { sessionId: session._id, turnNumber: Number(turnId) };

    const turn = await InterviewTurn.findOne(turnQuery);
    if (!turn) {
      throw new ApiError(404, 'Interview turn not found');
    }
    if (turn.speaker !== 'AI' || !turn.spokenText) {
      throw new ApiError(400, 'Turn is not an AI turn with spokenText');
    }

    const ttsResult = await ttsAdapter.synthesizeSpeech({ text: turn.spokenText });
    const prevRetries = Number(turn.ttsMetadata?.retryCount || 0);
    turn.ttsMetadata = {
      ...ttsResult.metadata,
      retryCount: prevRetries + 1,
    };
    turn.processingStatus = ttsResult.ok ? 'COMPLETED' : 'TTS_FAILED';
    await turn.save();

    await InterviewEvent.create({
      eventId: `evt_${crypto.randomUUID()}`,
      sessionId: session._id,
      intakeId: session.intakeId,
      eventType: ttsResult.ok ? 'TTS_RETRIED' : 'TTS_FAILED',
      payload: { turnNumber: turn.turnNumber, retryCount: prevRetries + 1, ok: ttsResult.ok },
      outboxStatus: 'INTERNAL',
    });

    return { turn, tts: ttsResult };
  };

  const handleInterruption = async ({ sessionId, turnNumber = null, interruptedAtMs = 0, reason }) => {
    const session = await loadAuthorizedSession(sessionId, null, { bypassOwnership: true });
    return recordTtsInterruption({ session, turnNumber, interruptedAtMs, reason });
  };

  const getSession = async ({ sessionId, userId }) => {
    return loadAuthorizedSession(sessionId, userId);
  };

  const getTranscript = async ({ sessionId, userId }) => {
    const session = await loadAuthorizedSession(sessionId, userId);
    const turns = await InterviewTurn.find({ sessionId: session._id }).sort({ turnNumber: 1 });
    return { session, turns };
  };

  const getProgress = async ({ sessionId, userId }) => {
    const session = await loadAuthorizedSession(sessionId, userId);
    const timeSnapshot = getTimeSnapshot(session, new Date());
    return { session, timeSnapshot };
  };

  const getInternalContext = async ({ sessionId }) => {
    const session = await loadAuthorizedSession(sessionId, null, { bypassOwnership: true });
    const [memory, turns, events] = await Promise.all([
      SessionMemory.findOne({ sessionId: session._id }),
      InterviewTurn.find({ sessionId: session._id }).sort({ turnNumber: 1 }),
      InterviewEvent.find({ sessionId: session._id }).sort({ occurredAt: 1 }),
    ]);
    return { session, memory, turns, events };
  };

  return {
    createSession,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    processTurn,
    retryTurnTts,
    handleInterruption,
    getSession,
    getTranscript,
    getProgress,
    getInternalContext,
    sttAdapter,
  };
};

module.exports = {
  createInterviewRuntimeService,
  computeBlueprintChecksum,
};
