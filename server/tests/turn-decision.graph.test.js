/**
 * Module 5 per-turn decision graph (LangGraph): routing, parity with the legacy sequential path,
 * and the skipped interviewer call when policy would discard its output.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';

const { createTurnDecider, agentOutputWouldBeDiscarded } = require('../modules/interview-orchestrator/runtime/turn-decision.graph');

const baseTurn = (overrides = {}) => ({
  blueprint: {},
  session: { sessionId: 'sess-graph', currentFollowUpCount: 0, askedQuestionIds: ['q1'], stageProgress: [] },
  memory: {},
  currentStage: { stageId: 'stg_1', stageType: 'CORE_TECHNICAL', title: 'Technical' },
  currentQuestion: { questionId: 'q1', prompt: 'Tell me about a project.' },
  nextQuestionCandidate: { questionId: 'q2', prompt: 'Explain the event loop.' },
  nextStageCandidate: null,
  followUpPolicy: { maxFollowUps: 2, allowedProbeTypes: ['DEPTH_PROBE'] },
  timeSnapshot: { timeMode: 'NORMAL' },
  candidateTranscript: 'I built an order service with three bounded contexts and an outbox.',
  candidateContext: null,
  requestId: 'turn-key-1',
  ...overrides,
});

const stubs = ({ classification, agentResult }) => {
  const calls = { classify: 0, decide: 0, decideArgs: null };
  const classifier = {
    classifyAnswer: async () => {
      calls.classify += 1;
      return classification;
    },
  };
  const interviewerAgent = {
    decideNextTurn: async (args) => {
      calls.decide += 1;
      calls.decideArgs = args;
      if (agentResult instanceof Error) throw agentResult;
      return agentResult;
    },
  };
  return { calls, classifier, interviewerAgent };
};

const RELEVANT = { intent: 'ANSWER', isRelevant: true, requiresClarification: false };
const AGENT_OK = {
  ok: true,
  fallbackUsed: false,
  decision: {
    action: 'MOVE_NEXT_QUESTION',
    spokenResponse: 'Thanks. Explain the event loop.',
    reasoning: 'Answer was complete.',
    candidateClaims: ['built an order service'],
    topicsMentioned: ['bounded contexts'],
    observedSignals: [],
  },
  llmMetadata: { provider: 'fake', model: 'fake', requestId: 'turn-key-1' },
};

/** Run the same turn through both engines (fresh stubs each) and return both results. */
const runBoth = async ({ classification, agentResult, turn = baseTurn() }) => {
  const g = stubs({ classification, agentResult: structuredClone(agentResult) });
  const l = stubs({ classification, agentResult: structuredClone(agentResult) });
  const graphOut = await createTurnDecider({ ...g, engine: 'langgraph' }).decide(turn);
  const legacyOut = await createTurnDecider({ ...l, engine: 'legacy' }).decide(turn);
  return { graphOut, legacyOut, graphCalls: g.calls, legacyCalls: l.calls };
};

describe('Per-turn decision graph (LangGraph)', () => {
  it('normal answer: classify -> decide -> resolve, same decision as the legacy path', async () => {
    const { graphOut, legacyOut, graphCalls } = await runBoth({ classification: RELEVANT, agentResult: AGENT_OK });
    assert.deepStrictEqual(graphOut.path, ['classify', 'decide', 'resolve']);
    assert.strictEqual(graphCalls.classify, 1);
    assert.strictEqual(graphCalls.decide, 1);
    assert.deepStrictEqual(graphOut.resolved, legacyOut.resolved);
    assert.deepStrictEqual(graphOut.classification, RELEVANT);
    assert.deepStrictEqual(graphOut.agentResult.llmMetadata, AGENT_OK.llmMetadata);
  });

  it('acknowledgement: interviewer LLM call is skipped, decision unchanged', async () => {
    const classification = { intent: 'ACKNOWLEDGEMENT', isRelevant: false, requiresClarification: false };
    const { graphOut, legacyOut, graphCalls, legacyCalls } = await runBoth({ classification, agentResult: AGENT_OK });
    assert.deepStrictEqual(graphOut.path, ['classify', 'resolve']);
    assert.strictEqual(graphCalls.decide, 0, 'no interviewer call for an acknowledgement');
    assert.strictEqual(legacyCalls.decide, 1, 'legacy path wastes the call');
    assert.deepStrictEqual(graphOut.resolved, legacyOut.resolved);
    assert.strictEqual(graphOut.agentResult.skipped, true);
    assert.strictEqual(graphOut.agentResult.llmMetadata.skipped, true);
  });

  it('unclear answer needing clarification: call skipped, same clarification', async () => {
    const classification = { intent: 'UNCLEAR', isRelevant: false, requiresClarification: true };
    const { graphOut, legacyOut, graphCalls } = await runBoth({ classification, agentResult: AGENT_OK });
    assert.strictEqual(graphCalls.decide, 0);
    assert.deepStrictEqual(graphOut.resolved, legacyOut.resolved);
  });

  it('time expired: the interviewer is still called (its candidate claims are kept)', async () => {
    const classification = { intent: 'ACKNOWLEDGEMENT', isRelevant: false, requiresClarification: false };
    const turn = baseTurn({ timeSnapshot: { timeMode: 'TIME_EXPIRED' } });
    const { graphOut, legacyOut, graphCalls } = await runBoth({ classification, agentResult: AGENT_OK, turn });
    assert.deepStrictEqual(graphOut.path, ['classify', 'decide', 'resolve']);
    assert.strictEqual(graphCalls.decide, 1);
    assert.deepStrictEqual(graphOut.resolved, legacyOut.resolved);
    assert.deepStrictEqual(graphOut.resolved.candidateClaims, AGENT_OK.decision.candidateClaims);
  });

  it('hard intents (repeat/skip) still call the agent and match legacy overrides', async () => {
    for (const intent of ['REQUEST_REPEAT', 'REQUEST_SKIP', 'OFF_TOPIC']) {
      const classification = { intent, isRelevant: false, requiresClarification: false };
      const { graphOut, legacyOut, graphCalls } = await runBoth({ classification, agentResult: AGENT_OK });
      assert.strictEqual(graphCalls.decide, 1, intent);
      assert.deepStrictEqual(graphOut.resolved, legacyOut.resolved, intent);
    }
  });

  it('interviewer failure falls back deterministically, as before', async () => {
    const failed = { ok: false, fallbackUsed: true, error: 'LLM timeout', llmMetadata: { model: 'fake' } };
    const { graphOut, legacyOut } = await runBoth({ classification: RELEVANT, agentResult: failed });
    assert.strictEqual(graphOut.resolved.fallbackUsed, true);
    assert.strictEqual(graphOut.resolved.action, 'MOVE_NEXT_QUESTION');
    assert.deepStrictEqual(graphOut.resolved, legacyOut.resolved);
  });

  it('passes the live session document by reference (no cloning through graph state)', async () => {
    const s = stubs({ classification: RELEVANT, agentResult: AGENT_OK });
    const turn = baseTurn();
    await createTurnDecider({ ...s, engine: 'langgraph' }).decide(turn);
    assert.strictEqual(s.calls.decideArgs.session, turn.session);
    assert.strictEqual(s.calls.decideArgs.classification.intent, 'ANSWER');
  });

  it('a thrown agent error propagates (the agent itself normally converts errors to fallbacks)', async () => {
    const s = stubs({ classification: RELEVANT, agentResult: new Error('boom') });
    await assert.rejects(createTurnDecider({ ...s, engine: 'langgraph' }).decide(baseTurn()), /boom/);
  });

  it('agentOutputWouldBeDiscarded mirrors the adaptive-engine override order', () => {
    const t = (intent, timeMode = 'NORMAL', requiresClarification = false) =>
      agentOutputWouldBeDiscarded({ classification: { intent, requiresClarification }, timeSnapshot: { timeMode } });
    assert.strictEqual(t('ACKNOWLEDGEMENT'), true);
    assert.strictEqual(t('UNCLEAR', 'NORMAL', true), true);
    assert.strictEqual(t('UNCLEAR', 'NORMAL', false), false);
    assert.strictEqual(t('ACKNOWLEDGEMENT', 'TIME_EXPIRED'), false);
    assert.strictEqual(t('ANSWER'), false);
    assert.strictEqual(t('REQUEST_REPEAT'), false);
  });
});
