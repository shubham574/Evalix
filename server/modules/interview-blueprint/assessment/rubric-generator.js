const { EvaluationRubricSchema } = require('./rubric.schema');

const RUBRIC_VERSION = '1.0';

const buildFivePointDescriptors = (competencyName, expectedEvidence = []) => {
  const focus = expectedEvidence[0] || `core ${competencyName} principles`;
  return [
    {
      rating: 1,
      label: 'Insufficient Evidence',
      descriptor: `Unable to explain ${competencyName} concepts or provides fundamentally incorrect reasoning regarding ${focus}.`,
    },
    {
      rating: 2,
      label: 'Limited Understanding',
      descriptor: `Shows surface-level familiarity with ${competencyName} but misses key mechanisms or ${focus}.`,
    },
    {
      rating: 3,
      label: 'Meets Expected Standard',
      descriptor: `Accurately explains ${competencyName} and demonstrates ${focus} with coherent practical reasoning.`,
    },
    {
      rating: 4,
      label: 'Strong Understanding',
      descriptor: `Demonstrates solid command of ${competencyName}, ${focus}, edge cases, and real-world trade-offs.`,
    },
    {
      rating: 5,
      label: 'Excellent Depth & Application',
      descriptor: `Articulates deep mastery of ${competencyName}, ${focus}, failure modes, and architectural/business impact.`,
    },
  ];
};

const generateRubricsForQuestions = ({ questions = [], competencies = [] }) => {
  const compById = new Map(competencies.map((c) => [c.competencyId, c]));

  return questions.map((q) => {
    const comp = compById.get(q.competencyIds[0]);
    const compName = comp?.name || q.competencyIds[0];

    const rubric = {
      rubricId: q.evaluationRubricId,
      competencyId: q.competencyIds[0],
      questionId: q.questionId,
      ratingScale: '1-5',
      ratingDescriptors: buildFivePointDescriptors(compName, q.expectedEvidence),
      expectedEvidence: q.expectedEvidence,
      criticalMisconceptions: [
        `Confusing ${compName} fundamentals or overlooking failure/edge-case behaviour.`,
      ],
      evaluationNotes: `Assess underlying conceptual accuracy and practical judgment on ${compName}; do not penalize non-verbatim terminology.`,
      partialCreditGuidance: `Award partial credit (rating 2-3) if candidate identifies correct intuition around ${compName} without full terminology.`,
      rubricVersion: RUBRIC_VERSION,
    };

    return EvaluationRubricSchema.parse(rubric);
  });
};

module.exports = {
  RUBRIC_VERSION,
  generateRubricsForQuestions,
};
