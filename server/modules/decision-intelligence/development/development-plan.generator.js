const crypto = require('crypto');
const { z } = require('zod');
const env = require('../../../config/env');

const DEV_PLAN_PROMPT_VERSION = 'module7.student_dev_plan.v2';

const practicalExerciseSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(5).max(400),
  successCriteria: z.array(z.string().max(250)).min(1).max(5),
});

const objectiveSchema = z.object({
  objectiveId: z.string().min(1),
  competencyId: z.string().min(1),
  competency: z.string().min(2).max(150).optional(),
  currentAssessment: z.string().max(60).optional(),
  developmentArea: z.string().min(3).max(300),
  currentEvidence: z.string().min(3).max(400),
  targetLearningOutcome: z.string().min(3).max(400),
  recommendedTopics: z.array(z.string().max(120)).min(1).max(6),
  practicalExercises: z.array(z.union([practicalExerciseSchema, z.string().max(400)])).min(1).max(4),
  practiceQuestions: z.array(z.string().max(300)).max(5).optional(),
  completionCriteria: z.array(z.string().max(300)).min(1).max(5),
  suggestedPriority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  estimatedEffort: z.string().max(80),
  sourceEvaluationReferences: z.array(z.string()).min(1),
});

const devPlanLlmSchema = z.object({
  summary: z.string().min(5).max(800),
  overallObjective: z.string().min(5).max(300).optional(),
  objectives: z.array(objectiveSchema).min(1).max(8),
});

const hasExternalUrl = (obj) => /https?:\/\//i.test(JSON.stringify(obj));

const buildDeterministicObjectives = ({
  competencyEvaluations = [],
  questionEvaluations = [],
}) => {
  const candidates = competencyEvaluations.filter(
    (c) =>
      c.assessmentStatus !== 'NOT_ASSESSED' &&
      c.assessmentStatus !== 'INSUFFICIENT_EVIDENCE' &&
      ((typeof c.score === 'number' && c.score < 4) ||
        (c.developmentAreas && c.developmentAreas.length > 0))
  );

  const targets =
    candidates.length > 0
      ? candidates
      : competencyEvaluations
          .filter(
            (c) =>
              c.assessmentStatus !== 'NOT_ASSESSED' &&
              c.assessmentStatus !== 'INSUFFICIENT_EVIDENCE'
          )
          .slice(0, 2);

  return targets.map((c, idx) => {
    const relatedQs = questionEvaluations.filter((q) => q.competencyId === c.competencyId);
    const gapText =
      (c.developmentAreas && c.developmentAreas[0]) ||
      relatedQs.flatMap((q) => q.missingEvidence || [])[0] ||
      `Deepen practical application of ${c.competencyName}`;

    const score = c.humanOverride?.revisedScore ?? c.score;
    const priority = typeof score === 'number' && score <= 2.5 ? 'HIGH' : 'MEDIUM';
    const currentAssessment =
      typeof score === 'number' && score < 2.5
        ? 'NEEDS_MORE_PRACTICE'
        : 'PARTIALLY_DEMONSTRATED';

    const exercise = {
      title: `Practise ${c.competencyName} with a concrete scenario`,
      description: `Design and walk through a focused scenario applying ${c.competencyName}, documenting key design choices, edge cases, and trade-offs.`,
      successCriteria: [
        `Explain the core concepts of ${c.competencyName} clearly without prompting`,
        'Articulate at least two real-world trade-offs and failure scenarios',
      ],
    };

    const practiceQuestions = relatedQs
      .map((q) => q.questionText)
      .filter(Boolean)
      .slice(0, 3);
    if (practiceQuestions.length === 0) {
      practiceQuestions.push(
        `How does ${c.competencyName} work under production constraints, and what trade-offs matter most?`
      );
    }

    return {
      objectiveId: `obj_${c.competencyId}_${idx + 1}`,
      competencyId: c.competencyId,
      competency: c.competencyName,
      currentAssessment,
      identifiedGap: gapText,
      developmentArea: gapText,
      currentEvidence:
        typeof score === 'number'
          ? `Your practice responses for ${c.competencyName} showed foundational understanding (${score}/5), with room to expand on ${gapText}.`
          : `Your practice responses did not provide enough detail for ${c.competencyName}.`,
      learningObjective: `Demonstrate clear, practical reasoning and trade-off awareness in ${c.competencyName}.`,
      targetLearningOutcome: `Demonstrate clear, practical reasoning and trade-off awareness in ${c.competencyName}.`,
      recommendedTopics: [
        `${c.competencyName} core mechanisms`,
        `${c.competencyName} edge cases and failure modes`,
        'Trade-off analysis with concrete examples',
      ],
      practicalExercises: [exercise],
      practiceQuestions,
      completionCriteria: exercise.successCriteria,
      priority,
      suggestedPriority: priority,
      estimatedEffort: priority === 'HIGH' ? '3-5 hours' : '2-3 hours',
      sourceEvaluationReferences:
        relatedQs.length > 0 ? relatedQs.map((q) => q.questionId) : [c.competencyId],
      sourceEvidenceReferences: relatedQs.flatMap((q) => q.evidenceReferences || []),
      progressStatus: 'NOT_STARTED',
    };
  });
};

const generateDevelopmentPlanContent = async (
  { competencyEvaluations = [], questionEvaluations = [], session, evaluationRun = null },
  { llmProvider = null } = {}
) => {
  const validCompIds = new Set(competencyEvaluations.map((c) => c.competencyId));
  const deterministicObjectives = buildDeterministicObjectives({
    competencyEvaluations,
    questionEvaluations,
  });

  const planTitle = `${session.targetRole || 'Interview'} Improvement Plan`;
  const overallObjective = `Strengthen ${session.targetRole || 'interview'} performance through targeted practice`;
  const sourceQuestionIds = Array.from(
    new Set(deterministicObjectives.flatMap((o) => o.sourceEvaluationReferences || []))
  );

  if (deterministicObjectives.length === 0) {
    const fallbackObj = {
      objectiveId: `obj_general_${crypto.randomBytes(3).toString('hex')}`,
      competencyId: competencyEvaluations[0]?.competencyId || 'GENERAL',
      competency: competencyEvaluations[0]?.competencyName || 'Structured Communication',
      currentAssessment: 'INSUFFICIENT_EVIDENCE',
      identifiedGap: 'Limited assessed question coverage in this session.',
      developmentArea: 'Structured interview communication',
      currentEvidence: 'Limited assessed question coverage in this session.',
      learningObjective: 'Present clear problem-context-tradeoff walkthroughs.',
      targetLearningOutcome: 'Present clear problem-context-tradeoff walkthroughs.',
      recommendedTopics: ['System trade-offs', 'Concrete project examples'],
      practicalExercises: [
        {
          title: '3-minute project architecture walkthrough',
          description: 'Practise explaining a past project architecture, key decisions, and outcomes in 3 minutes.',
          successCriteria: ['Cover context, your personal actions, and measurable outcomes clearly'],
        },
      ],
      practiceQuestions: ['Walk through a challenging technical problem you solved recently.'],
      completionCriteria: ['Cover context, action, and measurable outcome clearly.'],
      priority: 'MEDIUM',
      suggestedPriority: 'MEDIUM',
      estimatedEffort: '1-2 hours',
      sourceEvaluationReferences: [session.sessionId],
      sourceEvidenceReferences: [],
      progressStatus: 'NOT_STARTED',
    };

    return {
      planTitle,
      overallObjective,
      sourceSessionId: session.sessionId,
      sourceEvaluationId: evaluationRun ? String(evaluationRun._id) : null,
      targetCompetencyIds: [fallbackObj.competencyId],
      sourceQuestionIds: [],
      summary:
        'Your assessed practice responses did not surface specific gaps yet. Continue practising structured explanations with concrete project examples.',
      objectives: [fallbackObj],
      improvementObjectives: [fallbackObj],
      llmMetadata: null,
    };
  }

  if (llmProvider) {
    try {
      const res = await llmProvider.generateStructuredJson({
        systemInstruction: [
          'You are a constructive EVALIX student interview coach generating a personalised development plan.',
          'RULES:',
          '1. Be encouraging and educational; never claim a student lacks a skill when evidence was insufficient.',
          '2. Do NOT invent external URLs, paid courses, or certifications. Create self-contained practical exercises only.',
          '3. Every objective MUST use one of the provided valid competencyIds and cite sourceEvaluationReferences.',
          '4. Return ONLY valid JSON matching the schema.',
        ].join('\n'),
        userPrompt: JSON.stringify({
          targetRole: session.targetRole,
          practiceMode: session.practiceMode || 'REALISTIC_MOCK',
          validCompetencyIds: Array.from(validCompIds),
          seedGaps: deterministicObjectives.map((o) => ({
            competencyId: o.competencyId,
            competency: o.competency,
            developmentArea: o.developmentArea,
            sourceEvaluationReferences: o.sourceEvaluationReferences,
          })),
        }),
        requestId: `dev_plan_${session.sessionId}`,
      });

      const parsed = devPlanLlmSchema.safeParse(res?.data);
      if (
        parsed.success &&
        !hasExternalUrl(parsed.data) &&
        parsed.data.objectives.every((o) => validCompIds.has(o.competencyId))
      ) {
        const normalized = parsed.data.objectives.map((o) => ({
          ...o,
          identifiedGap: o.developmentArea,
          learningObjective: o.targetLearningOutcome,
          priority: o.suggestedPriority,
          progressStatus: 'NOT_STARTED',
        }));

        return {
          planTitle,
          overallObjective: parsed.data.overallObjective || overallObjective,
          sourceSessionId: session.sessionId,
          sourceEvaluationId: evaluationRun ? String(evaluationRun._id) : null,
          targetCompetencyIds: Array.from(new Set(normalized.map((o) => o.competencyId))),
          sourceQuestionIds,
          summary: parsed.data.summary,
          objectives: normalized,
          improvementObjectives: normalized,
          llmMetadata: {
            provider: res.provider || 'gemini',
            model: res.model || env.AI_EXTRACTION_MODEL,
            promptVersion: DEV_PLAN_PROMPT_VERSION,
          },
        };
      }
    } catch (_err) {
      // Deterministic fallback below
    }
  }

  return {
    planTitle,
    overallObjective,
    sourceSessionId: session.sessionId,
    sourceEvaluationId: evaluationRun ? String(evaluationRun._id) : null,
    targetCompetencyIds: Array.from(new Set(deterministicObjectives.map((o) => o.competencyId))),
    sourceQuestionIds,
    summary: `Personalised coaching plan focused on ${deterministicObjectives.length} growth area(s) from your ${session.targetRole} practice session.`,
    objectives: deterministicObjectives,
    improvementObjectives: deterministicObjectives,
    llmMetadata: null,
  };
};

module.exports = {
  generateDevelopmentPlanContent,
  buildDeterministicObjectives,
  DEV_PLAN_PROMPT_VERSION,
};
