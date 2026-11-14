const { z } = require('zod');
const env = require('../../../config/env');

const ANSWER_IMPROVEMENT_PROMPT_VERSION = 'module7.answer_improvement.v1';

const answerGuidanceItemSchema = z.object({
  questionId: z.string().min(1),
  whatWasGood: z.array(z.string().max(300)).min(1),
  whatWasMissing: z.array(z.string().max(300)),
  structureSuggestions: z.array(z.string().max(300)).min(1),
  keyConceptsToMention: z.array(z.string().max(150)).min(1),
  betterAnswerOutline: z.array(z.string().max(300)).min(2),
  illustrativeExampleAnswer: z.string().min(20).max(1500),
  whyStronger: z.string().min(10).max(500),
});

const answerGuidanceLlmSchema = z.object({
  items: z.array(answerGuidanceItemSchema),
});

const buildDeterministicGuidanceItem = ({ qEval, candidateTurn }) => {
  const isBehavioural = String(qEval.questionType || '').toUpperCase().includes('BEHAVIOUR');
  const rawAnswer =
    candidateTurn?.spokenText ||
    candidateTurn?.rawTranscript ||
    qEval.answerSummary ||
    'Response was brief or partially captured.';

  const candidateAnswerSummary =
    rawAnswer.length > 260 ? `${rawAnswer.slice(0, 257)}...` : rawAnswer;

  const whatWasGood =
    Array.isArray(qEval.strengths) && qEval.strengths.length > 0
      ? qEval.strengths
      : qEval.rating >= 3
      ? ['Addressed the core topic of the question.']
      : ['Attempted the question directly.'];

  const whatWasMissing =
    Array.isArray(qEval.missingEvidence) && qEval.missingEvidence.length > 0
      ? qEval.missingEvidence
      : Array.isArray(qEval.improvements) && qEval.improvements.length > 0
      ? qEval.improvements
      : ['Concrete trade-offs, edge cases, or measurable outcomes.'];

  const structureSuggestions = isBehavioural
    ? [
        'Use the STAR structure: Situation (brief context), Task (your responsibility), Action (specific steps you took), and Result (measurable or observable outcome).',
        'Focus on your individual contribution using your own real project experiences.',
      ]
    : [
        'Start with a clear 1-sentence core definition, then explain how it works internally, and finish with trade-offs and a real project example.',
        'Organise your explanation in 3 short parts: Concept -> Practical Trade-off -> Example.',
      ];

  const keyConceptsToMention =
    whatWasMissing.length > 0
      ? whatWasMissing.slice(0, 4)
      : ['Core mechanism', 'Trade-offs', 'Failure handling'];

  const betterAnswerOutline = isBehavioural
    ? [
        'Situation & Task: Briefly describe the real context and your specific goal.',
        'Action: Explain the 2–3 concrete decisions or steps you personally took.',
        'Result & Reflection: Share the outcome and what you would refine next time.',
      ]
    : [
        'Core Answer: State the direct concept clearly in 1–2 sentences.',
        'Mechanism & Trade-offs: Explain how it works and when to choose alternatives.',
        'Concrete Example: Connect it to a system or query you have worked on.',
      ];

  const illustrativeExampleAnswer = isBehavioural
    ? 'Illustrative STAR outline (fill in with your real experience): "In [your project/coursework], we faced [specific challenge]. My responsibility was [your task]. I decided to [specific action you took] rather than [alternative], which resulted in [verified outcome from your experience]."'
    : `Illustrative example (one valid approach): "At a high level, ${qEval.questionText || 'this concept'} addresses the problem by balancing consistency, latency, and complexity. In practice, you should consider ${keyConceptsToMention.join(', ')} depending on workload constraints."`;

  const whyStronger = isBehavioural
    ? 'Separating Situation, Task, Action, and Result makes your individual contribution easy to follow without overloading context.'
    : 'Leading with a concise definition followed by trade-offs and a concrete example shows both conceptual clarity and practical judgment.';

  return {
    questionId: qEval.questionId,
    competencyId: qEval.competencyId || null,
    questionType: qEval.questionType || 'TECHNICAL',
    originalQuestion: qEval.questionText || `Question ${qEval.questionId}`,
    candidateAnswerSummary,
    whatWasGood,
    whatWasMissing,
    structureSuggestions,
    keyConceptsToMention,
    betterAnswerOutline,
    illustrativeExampleAnswer,
    illustrativeNote:
      'Illustrative learning guidance only. Multiple technically valid explanations exist; never copy unverified experiences.',
    whyStronger,
    sourceEvidenceReferences: (qEval.evidenceReferences || []).map((r) => ({
      turnId: r.turnId ? String(r.turnId) : null,
      snippet: r.snippet || '',
    })),
  };
};

const buildAnswerImprovementGuidance = async (
  { questionEvaluations = [], turns = [] },
  { llmProvider = null } = {}
) => {
  const turnById = new Map(turns.map((t) => [String(t._id), t]));
  const turnByQuestionId = new Map();
  for (const t of turns) {
    if (t.speaker === 'CANDIDATE' && t.questionId && !turnByQuestionId.has(t.questionId)) {
      turnByQuestionId.set(t.questionId, t);
    }
  }

  const targets = questionEvaluations.filter(
    (q) =>
      q.evaluationStatus !== 'NOT_ASKED' &&
      (q.rating === null ||
        q.rating <= 3.5 ||
        (q.missingEvidence && q.missingEvidence.length > 0) ||
        q.evaluationStatus === 'PARTIALLY_EVALUATED')
  );

  if (targets.length === 0) return [];

  const deterministicItems = targets.map((qEval) => {
    const firstRefTurnId = qEval.evidenceReferences?.[0]?.turnId
      ? String(qEval.evidenceReferences[0].turnId)
      : null;
    const candidateTurn =
      (firstRefTurnId && turnById.get(firstRefTurnId)) ||
      turnByQuestionId.get(qEval.questionId) ||
      null;
    return buildDeterministicGuidanceItem({ qEval, candidateTurn });
  });

  if (!llmProvider) return deterministicItems;

  const validQIds = new Set(targets.map((q) => q.questionId));
  try {
    const res = await llmProvider.generateStructuredJson({
      systemInstruction: [
        'You are an encouraging EVALIX interview coach helping a student improve specific interview answers.',
        'RULES:',
        '1. Never invent or fabricate personal experiences, metrics, or stories for the student.',
        '2. For behavioural questions, provide a STAR template with placeholders only.',
        '3. Recognise that multiple technically valid explanations exist.',
        '4. Never comment on accent, voice pitch, or appearance.',
        '5. Every item MUST use one of the provided questionIds.',
      ].join('\n'),
      userPrompt: JSON.stringify({
        questions: deterministicItems.map((d) => ({
          questionId: d.questionId,
          questionType: d.questionType,
          originalQuestion: d.originalQuestion,
          candidateAnswerSummary: d.candidateAnswerSummary,
          whatWasMissing: d.whatWasMissing,
        })),
      }),
      requestId: `ans_improve_${targets[0]?.sessionId || 'sess'}`,
    });

    const parsed = answerGuidanceLlmSchema.safeParse(res?.data);
    if (
      parsed.success &&
      parsed.data.items.every((item) => validQIds.has(item.questionId))
    ) {
      const llmByQ = new Map(parsed.data.items.map((i) => [i.questionId, i]));
      return deterministicItems.map((base) => {
        const enriched = llmByQ.get(base.questionId);
        return enriched
          ? {
              ...base,
              ...enriched,
              llmMetadata: {
                provider: res.provider || 'gemini',
                model: res.model || env.AI_EXTRACTION_MODEL,
                promptVersion: ANSWER_IMPROVEMENT_PROMPT_VERSION,
              },
            }
          : base;
      });
    }
  } catch (_err) {
    // Deterministic fallback
  }

  return deterministicItems;
};

module.exports = {
  buildAnswerImprovementGuidance,
  ANSWER_IMPROVEMENT_PROMPT_VERSION,
};
