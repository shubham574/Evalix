const { z } = require('zod');

const INTERVIEWER_ACTIONS = [
  'ASK_FOLLOW_UP',
  'MOVE_NEXT_QUESTION',
  'ADVANCE_STAGE',
  'CLARIFY_OR_REPEAT',
  'PAUSE_FOR_THINKING',
  'WRAP_UP_INTERVIEW',
];

const FOLLOW_UP_TYPES = [
  'CLARIFICATION',
  'TECHNICAL_DEPTH',
  'DEPTH_PROBE',
  'ARCHITECTURE',
  'TRADE_OFF',
  'TRADEOFF_PROBE',
  'PERSONAL_CONTRIBUTION',
  'CHALLENGE',
  'PROBLEM_SOLVING',
  'PERFORMANCE',
  'SECURITY',
  'SCALABILITY',
  'EXAMPLE_PROBE',
  'EDGE_CASE_PROBE',
  'NONE',
];

const interviewerDecisionSchema = z.object({
  action: z.enum(INTERVIEWER_ACTIONS),
  followUpType: z.enum(FOLLOW_UP_TYPES).default('NONE'),
  spokenResponse: z.string().min(1).max(1600),
  reasoning: z.string().max(600).default(''),
  candidateClaims: z
    .array(
      z.object({
        summary: z.string().min(1).max(240),
        technologies: z.array(z.string().max(50)).max(8).default([]),
      })
    )
    .max(5)
    .default([]),
  topicsMentioned: z.array(z.string().max(60)).max(10).default([]),
  observedSignals: z.array(z.string().max(100)).max(8).default([]),
  recommendedNextStageId: z.string().max(80).nullable().optional(),
  recommendedNextQuestionId: z.string().max(80).nullable().optional(),
});

module.exports = {
  INTERVIEWER_ACTIONS,
  FOLLOW_UP_TYPES,
  interviewerDecisionSchema,
};
