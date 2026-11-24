/**
 * Per-turn decision as a LangGraph StateGraph.
 *
 *   START -> classify --(agent output would be discarded)--> resolve -> END
 *                     \--(otherwise)--> decide -> resolve -> END
 *
 *  - classify: answer classifier (intent / relevance / language; fast path for short control phrases)
 *  - decide:   interviewer agent LLM call (proposes the next action + spoken response)
 *  - resolve:  deterministic policy - hard intent / time overrides, proposal validation, fallback
 *
 * Scope is deliberately the decision only. The graph has no checkpointer: persistence, the
 * session state machine, stateVersion locking and turn idempotency stay in interview-runtime.
 *
 * The heavy per-turn context (session document, blueprint, transcript) is passed through
 * `config.configurable.turn`, not graph state, so it is never copied or sent to LangSmith traces.
 *
 * INTERVIEW_TURN_ENGINE=legacy runs the same three steps sequentially without LangGraph.
 */
const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const { resolveAdaptiveDecision } = require('../adaptive/adaptive-engine');

const TurnDecisionState = Annotation.Root({
  classification: Annotation(),
  agentResult: Annotation(),
  resolved: Annotation(),
  /** Nodes visited, for observability and tests. */
  path: Annotation({ reducer: (acc, next) => acc.concat(next), default: () => [] }),
});

/**
 * True when resolveAdaptiveDecision would ignore the interviewer's output completely, so the
 * LLM call can be skipped. Mirrors the override order in adaptive-engine: TIME_EXPIRED is checked
 * first and keeps the agent's candidate claims, so it never skips; ACKNOWLEDGEMENT and
 * UNCLEAR-needing-clarification return a deterministic decision with empty claims.
 */
const agentOutputWouldBeDiscarded = ({ classification, timeSnapshot }) => {
  if (timeSnapshot?.timeMode === 'TIME_EXPIRED') return false;
  if (classification?.intent === 'ACKNOWLEDGEMENT') return true;
  return classification?.intent === 'UNCLEAR' && Boolean(classification?.requiresClarification);
};

const skippedAgentResult = (classification, requestId) => ({
  ok: false,
  fallbackUsed: true,
  skipped: true,
  llmMetadata: {
    skipped: true,
    reason: `interviewer call skipped for ${classification?.intent || 'unknown'} intent`,
    requestId,
  },
});

const classifyStep = (classifier, turn) =>
  classifier.classifyAnswer({
    transcript: turn.candidateTranscript,
    currentQuestion: turn.currentQuestion,
    currentStage: turn.currentStage,
    requestId: turn.requestId,
  });

const decideStep = (interviewerAgent, turn, classification) =>
  interviewerAgent.decideNextTurn({ ...turn, classification });

const resolveStep = (turn, classification, agentResult) =>
  resolveAdaptiveDecision({ ...turn, agentResult, classification });

const buildTurnDecisionGraph = ({ classifier, interviewerAgent }) =>
  new StateGraph(TurnDecisionState)
    .addNode('classify', async (_state, config) => {
      const classification = await classifyStep(classifier, config.configurable.turn);
      return { classification, path: ['classify'] };
    })
    .addNode('decide', async (state, config) => {
      const agentResult = await decideStep(interviewerAgent, config.configurable.turn, state.classification);
      return { agentResult, path: ['decide'] };
    })
    .addNode('resolve', async (state, config) => {
      const { turn } = config.configurable;
      const agentResult = state.agentResult || skippedAgentResult(state.classification, turn.requestId);
      return { agentResult, resolved: resolveStep(turn, state.classification, agentResult), path: ['resolve'] };
    })
    .addEdge(START, 'classify')
    .addConditionalEdges(
      'classify',
      (state, config) =>
        agentOutputWouldBeDiscarded({
          classification: state.classification,
          timeSnapshot: config.configurable.turn.timeSnapshot,
        })
          ? 'resolve'
          : 'decide',
      ['decide', 'resolve']
    )
    .addEdge('decide', 'resolve')
    .addEdge('resolve', END)
    .compile();

/**
 * @returns {{ engine: string, decide: (turn: object) => Promise<{classification, agentResult, resolved, path}> }}
 * `turn` holds what the classifier, interviewer agent and adaptive resolver need: blueprint, session,
 * memory, currentStage, currentQuestion, nextQuestionCandidate, nextStageCandidate, followUpPolicy,
 * timeSnapshot, candidateTranscript, candidateContext, requestId.
 */
const createTurnDecider = ({ classifier, interviewerAgent, engine = 'langgraph' }) => {
  if (engine === 'legacy') {
    return {
      engine,
      decide: async (turn) => {
        const classification = await classifyStep(classifier, turn);
        const agentResult = await decideStep(interviewerAgent, turn, classification);
        const resolved = resolveStep(turn, classification, agentResult);
        return { classification, agentResult, resolved, path: ['classify', 'decide', 'resolve'] };
      },
    };
  }

  const graph = buildTurnDecisionGraph({ classifier, interviewerAgent });
  return {
    engine: 'langgraph',
    graph,
    decide: async (turn) => {
      const out = await graph.invoke(
        {},
        {
          configurable: { turn },
          runName: 'evalix.interviewTurnDecision',
          tags: ['evalix', 'interview-turn'],
          metadata: { requestId: turn.requestId, sessionId: String(turn.session?.sessionId || '') },
        }
      );
      return {
        classification: out.classification,
        agentResult: out.agentResult,
        resolved: out.resolved,
        path: out.path,
      };
    },
  };
};

module.exports = { createTurnDecider, buildTurnDecisionGraph, agentOutputWouldBeDiscarded };
