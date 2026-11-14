const { z } = require('zod');

const RatingDescriptorSchema = z.object({
  rating: z.number().int().min(1).max(5),
  label: z.string().min(2),
  descriptor: z.string().min(8).max(400),
});

const EvaluationRubricSchema = z.object({
  rubricId: z.string().min(1),
  competencyId: z.string().min(1),
  questionId: z.string().min(1),
  ratingScale: z.literal('1-5').default('1-5'),
  ratingDescriptors: z
    .array(RatingDescriptorSchema)
    .length(5)
    .refine(
      (items) => {
        const ratings = new Set(items.map((i) => i.rating));
        return [1, 2, 3, 4, 5].every((r) => ratings.has(r));
      },
      { message: 'Rubric must define distinct descriptors for ratings 1 through 5' }
    ),
  expectedEvidence: z.array(z.string().min(2)).min(1),
  criticalMisconceptions: z.array(z.string()).default([]),
  evaluationNotes: z.string().default('Evaluate conceptual accuracy and practical reasoning rather than exact phrasing.'),
  partialCreditGuidance: z.string().default('Award partial credit for sound core intuition even if edge-case terminology differs.'),
  rubricVersion: z.string().default('1.0'),
});

const GeneratedRubricsLlmSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  rubrics: z.array(
    z.object({
      questionKey: z.string().min(1),
      ratingDescriptors: z.array(RatingDescriptorSchema).length(5),
      expectedEvidence: z.array(z.string().min(2)).min(1),
      criticalMisconceptions: z.array(z.string()).default([]),
      partialCreditGuidance: z.string().min(5).max(400),
    })
  ),
});

module.exports = {
  RatingDescriptorSchema,
  EvaluationRubricSchema,
  GeneratedRubricsLlmSchema,
};
