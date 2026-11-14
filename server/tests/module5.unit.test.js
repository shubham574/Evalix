const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  SESSION_STATUSES,
  canTransitionSession,
  assertSessionTransition,
  canAcceptTurn,
} = require('../modules/interview-orchestrator/session/session-state-machine');
const { getTimeSnapshot } = require('../modules/interview-orchestrator/runtime/time-manager');
const {
  getNextUnaskedQuestion,
  getFollowUpPolicy,
} = require('../modules/interview-orchestrator/runtime/question-manager');
const { validateAdaptiveProposal } = require('../modules/interview-orchestrator/adaptive/probe-validator');
const { resolveAdaptiveDecision } = require('../modules/interview-orchestrator/adaptive/adaptive-engine');
const { createSttAdapter } = require('../modules/interview-orchestrator/voice/stt.adapter');
const { createTtsAdapter } = require('../modules/interview-orchestrator/voice/tts.adapter');
const {
  toCandidateSession,
  toCandidateTurn,
} = require('../modules/interview-orchestrator/serializers/session.serializer');

describe('Module 5 Unit Tests — State Machine, Adaptive Guardrails, Voice Adapters & Serializers', () => {
  it('enforces valid and invalid session state transitions', () => {
    assert.strictEqual(canTransitionSession(SESSION_STATUSES.CREATED, SESSION_STATUSES.READY), true);
    assert.strictEqual(canTransitionSession(SESSION_STATUSES.IN_PROGRESS, SESSION_STATUSES.PAUSED), true);
    assert.strictEqual(canTransitionSession(SESSION_STATUSES.PAUSED, SESSION_STATUSES.IN_PROGRESS), true);
    assert.strictEqual(canTransitionSession(SESSION_STATUSES.COMPLETED, SESSION_STATUSES.IN_PROGRESS), false);
    assert.strictEqual(canTransitionSession(SESSION_STATUSES.ABANDONED, SESSION_STATUSES.IN_PROGRESS), false);

    assert.throws(
      () => assertSessionTransition(SESSION_STATUSES.COMPLETED, SESSION_STATUSES.PAUSED),
      /Invalid interview session transition/
    );
    assert.strictEqual(canAcceptTurn(SESSION_STATUSES.IN_PROGRESS), true);
    assert.strictEqual(canAcceptTurn(SESSION_STATUSES.PAUSED), false);
  });

  it('computes time pressure modes accurately', () => {
    const now = new Date();
    const session = {
      status: 'IN_PROGRESS',
      totalDurationSeconds: 600,
      activeDurationSeconds: 590,
      pausedDurationSeconds: 0,
      currentStageId: 'stg_1',
      stageProgress: [{ stageId: 'stg_1', allocatedDurationSeconds: 300, elapsedSeconds: 310 }],
      lastActivityAt: new Date(now.getTime() - 15000),
    };

    const snap = getTimeSnapshot(session, now);
    assert.strictEqual(snap.timeMode, 'TIME_EXPIRED');
    assert.strictEqual(snap.remainingSessionSeconds, 0);
  });

  it('selects next unasked question without repeating askedQuestionIds', () => {
    const blueprint = {
      coreQuestions: [
        { questionId: 'q1', stageId: 'stg_1', prompt: 'Q1' },
        { questionId: 'q2', stageId: 'stg_1', prompt: 'Q2' },
      ],
      personalisedQuestions: [],
      questionPlan: [
        { stageId: 'stg_1', questionId: 'q1' },
        { stageId: 'stg_1', questionId: 'q2' },
      ],
    };
    const session = {
      askedQuestionIds: ['q1'],
      stageProgress: [{ stageId: 'stg_1', questionIds: ['q1', 'q2'] }],
    };
    const next = getNextUnaskedQuestion(session, blueprint, 'stg_1');
    assert.strictEqual(next.questionId, 'q2');
  });

  it('rejects backward stage jumps, duplicate questions, and excess follow-ups', () => {
    const session = {
      status: 'IN_PROGRESS',
      currentStageId: 'stg_2',
      currentFollowUpCount: 2,
      askedQuestionIds: ['q1', 'q2'],
      stageProgress: [
        { stageId: 'stg_1', status: 'COMPLETED' },
        { stageId: 'stg_2', status: 'ACTIVE' },
      ],
    };
    const blueprint = { followUpPolicies: [{ questionId: 'q2', maxFollowUps: 2 }] };
    const followUpPolicy = getFollowUpPolicy(blueprint, 'q2');

    const backJump = validateAdaptiveProposal({
      proposedDecision: { action: 'ADVANCE_STAGE', recommendedNextStageId: 'stg_1', spokenResponse: 'Back' },
      session,
      blueprint,
      currentQuestion: { questionId: 'q2' },
      nextStageCandidate: null,
      followUpPolicy,
      timeSnapshot: { timeMode: 'NORMAL' },
    });
    assert.strictEqual(backJump.valid, false);

    const dupQ = validateAdaptiveProposal({
      proposedDecision: { action: 'MOVE_NEXT_QUESTION', recommendedNextQuestionId: 'q1', spokenResponse: 'Dup' },
      session,
      blueprint,
      currentQuestion: { questionId: 'q2' },
      nextQuestionCandidate: { questionId: 'q3' },
      followUpPolicy,
      timeSnapshot: { timeMode: 'NORMAL' },
    });
    assert.strictEqual(dupQ.valid, false);

    const excessFollowUp = validateAdaptiveProposal({
      proposedDecision: { action: 'ASK_FOLLOW_UP', followUpType: 'DEPTH_PROBE', spokenResponse: 'More?' },
      session,
      blueprint,
      currentQuestion: { questionId: 'q2' },
      followUpPolicy,
      timeSnapshot: { timeMode: 'NORMAL' },
    });
    assert.strictEqual(excessFollowUp.valid, false);
  });

  it('falls back deterministically when LLM fails or time expires', () => {
    const resolved = resolveAdaptiveDecision({
      agentResult: { ok: false, error: 'LLM timeout' },
      session: { currentFollowUpCount: 0, askedQuestionIds: ['q1'], stageProgress: [] },
      blueprint: {},
      currentStage: { stageId: 'stg_1', stageType: 'CORE_TECHNICAL', title: 'Technical' },
      currentQuestion: { questionId: 'q1' },
      nextQuestionCandidate: { questionId: 'q2', prompt: 'Explain event loop.' },
      nextStageCandidate: null,
      followUpPolicy: { maxFollowUps: 2, allowedProbeTypes: ['DEPTH_PROBE'] },
      timeSnapshot: { timeMode: 'NORMAL' },
    });
    assert.strictEqual(resolved.action, 'MOVE_NEXT_QUESTION');
    assert.strictEqual(resolved.fallbackUsed, true);
    assert.ok(resolved.spokenResponse.includes('Explain event loop.'));
  });

  it('ignores PARTIAL STT transcripts and handles TTS failure gracefully', async () => {
    const stt = createSttAdapter();
    const partial = await stt.resolveCandidateInput({
      transcriptText: 'um I used...',
      transcriptStatus: 'PARTIAL',
    });
    assert.strictEqual(partial.ignoredForDecision, true);
    assert.strictEqual(partial.reason, 'PARTIAL_TRANSCRIPT_IGNORED');

    const tts = createTtsAdapter({
      ttsProvider: {
        synthesize: async () => {
          throw new Error('ElevenLabs 503');
        },
      },
    });
    const ttsRes = await tts.synthesizeSpeech({ text: 'Hello candidate' });
    assert.strictEqual(ttsRes.ok, false);
    assert.strictEqual(ttsRes.fallbackToBrowser, true);
  });

  it('strips internal metadata and private rubrics in candidate serializers', () => {
    const safeSession = toCandidateSession({
      _id: '507f1f77bcf86cd799439011',
      sessionId: 'sess_123',
      intakeId: '507f1f77bcf86cd799439012',
      blueprintId: '507f1f77bcf86cd799439013',
      blueprintVersion: 1,
      blueprintChecksum: 'secret_sha256_hash',
      interviewType: 'TECHNICAL',
      targetRole: 'Backend Engineer',
      seniorityLevel: 'MID',
      status: 'IN_PROGRESS',
      totalDurationSeconds: 1800,
    });
    assert.strictEqual(safeSession.blueprintChecksum, undefined);

    const safeTurn = toCandidateTurn({
      _id: '507f1f77bcf86cd799439014',
      turnNumber: 2,
      speaker: 'AI',
      turnType: 'FOLLOW_UP',
      spokenText: 'Can you elaborate?',
      transcriptStatus: 'NONE',
      processingStatus: 'COMPLETED',
      adaptiveDecision: { action: 'ASK_FOLLOW_UP', reason: 'PRIVATE_RUBRIC_REASON' },
      llmMetadata: { model: 'gemini-3.5-flash', usage: { totalTokens: 123 } },
    });
    assert.strictEqual(safeTurn.adaptiveDecision, undefined);
    assert.strictEqual(safeTurn.llmMetadata, undefined);
  });
});
