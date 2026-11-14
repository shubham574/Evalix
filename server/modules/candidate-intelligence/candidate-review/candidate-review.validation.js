const { z } = require('zod');
const { CANDIDATE_ACTIONS } = require('./candidateClaimReview.model');

const claimReviewBodySchema = z
  .object({
    candidateAction: z.enum(CANDIDATE_ACTIONS),
    correctedValue: z.unknown().optional(),
    explanation: z.string().trim().max(2000).optional(),
    factType: z
      .enum([
        'SKILL',
        'EMPLOYMENT',
        'PROJECT',
        'EDUCATION',
        'CERTIFICATION',
        'PROFESSIONAL_TITLE',
        'DOMAIN_EXPERIENCE',
      ])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.candidateAction === 'CORRECT' || data.candidateAction === 'ADD_MISSING_INFORMATION') &&
      (data.correctedValue === undefined || data.correctedValue === null || data.correctedValue === '')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctedValue'],
        message: 'correctedValue is required for CORRECT and ADD_MISSING_INFORMATION actions',
      });
    }
  });

module.exports = {
  claimReviewBodySchema,
};
