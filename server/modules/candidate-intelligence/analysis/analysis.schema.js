const { z } = require('zod');

const SEMANTIC_MATCH_TYPES = [
  'SEMANTIC_MATCH',
  'TRANSFERABLE_SKILL',
  'POSSIBLE_MATCH_REQUIRES_REVIEW',
  'NO_MATCH',
];

const ASSESSMENT_STATUSES = [
  'SUPPORTED_DIRECTLY',
  'SUPPORTED_BY_TRANSFERABLE_EVIDENCE',
  'PARTIALLY_SUPPORTED',
  'NOT_EVIDENCED',
  'CONFLICTING_EVIDENCE',
  'REQUIRES_CANDIDATE_CONFIRMATION',
  'NOT_APPLICABLE',
];

const SemanticMatchProposalSchema = z.object({
  requirementId: z.string().min(1),
  matchType: z.enum(SEMANTIC_MATCH_TYPES),
  assessment: z.enum(ASSESSMENT_STATUSES),
  candidateFactIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  explanation: z.string().min(1).max(600),
  missingEvidence: z.array(z.string()).default([]),
});

const SemanticMatcherOutputSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  proposals: z.array(SemanticMatchProposalSchema).default([]),
});

module.exports = {
  SEMANTIC_MATCH_TYPES,
  ASSESSMENT_STATUSES,
  SemanticMatchProposalSchema,
  SemanticMatcherOutputSchema,
};
