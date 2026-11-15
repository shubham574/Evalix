const { z } = require('zod');

const QUESTION_TYPES = [
  'INTRODUCTION',
  'TECHNICAL_CONCEPT',
  'CORE_TECHNICAL',
  'PROJECT_DEEP_DIVE',
  'EXPERIENCE_VALIDATION',
  'EXPERIENCE_DEEP_DIVE',
  'PRACTICAL_TASK',
  'PROBLEM_SOLVING',
  'SYSTEM_DESIGN',
  'BEHAVIOURAL',
  'BEHAVIORAL',
  'COMMUNICATION',
  'SITUATIONAL',
  'ROLE_SPECIFIC',
];

const QUESTION_CATEGORIES = [
  'INTRODUCTION',
  'CORE',
  'CORE_TECHNICAL',
  'PROJECT_DEEP_DIVE',
  'EXPERIENCE_VALIDATION',
  'EXPERIENCE_DEEP_DIVE',
  'PRACTICAL',
  'PROBLEM_SOLVING',
  'SYSTEM_DESIGN',
  'BEHAVIOURAL',
  'BEHAVIORAL',
  'COMMUNICATION',
  'SITUATIONAL',
  'ROLE_SPECIFIC',
];

const CONSISTENCY_CLASSES = [
  'CORE_ASSESSMENT',
  'PERSONALISED_ASSESSMENT',
  'OPTIONAL_EXPLORATORY',
];

const DIFFICULTY_LEVELS = ['FOUNDATIONAL', 'BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

const PROBE_TYPES = [
  'CLARIFICATION',
  'DEEP_DIVE',
  'EXAMPLE_REQUEST',
  'TRADE_OFF',
  'EDGE_CASE',
  'IMPACT_VERIFICATION',
  'OWNERSHIP_VERIFICATION',
  'ALTERNATIVE_APPROACH',
];

const FollowUpPolicySchema = z.object({
  enabled: z.boolean().default(true),
  maxFollowUps: z.number().int().min(0).max(4).default(2),
  followUpBudgetSeconds: z.number().int().min(0).max(300).default(90),
  triggerCondition: z.string().default('When initial response lacks depth or concrete evidence'),
  allowedProbeTypes: z.array(z.enum(PROBE_TYPES)).default(['CLARIFICATION', 'DEEP_DIVE']),
});

const PlannedQuestionSchema = z.object({
  questionId: z.string().min(1),
  stageId: z.string().min(1),
  questionType: z.enum(QUESTION_TYPES),
  questionCategory: z.enum(QUESTION_CATEGORIES),
  consistencyClass: z.enum(CONSISTENCY_CLASSES).default('CORE_ASSESSMENT'),
  questionText: z.string().min(10).max(1000),
  candidateVisible: z.boolean().default(true),
  competencyIds: z.array(z.string().min(1)).min(1),
  requirementIds: z.array(z.string()).default([]),
  candidateFactReferences: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([]),
  difficulty: z.enum(DIFFICULTY_LEVELS).default('INTERMEDIATE'),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  purpose: z.string().min(5).max(500),
  expectedResponseSeconds: z.number().int().min(30).max(1200).default(120),
  thinkingAllowanceSeconds: z.number().int().min(0).max(120).default(15),
  followUpPolicy: FollowUpPolicySchema.default({}),
  evaluationRubricId: z.string().min(1),
  expectedEvidence: z.array(z.string().min(2)).min(1),
  templateVersion: z.string().default('1.0'),
});

const GeneratedQuestionsLlmSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  questions: z.array(
    z.object({
      questionKey: z.string().min(1),
      questionText: z.string().min(10).max(1000),
      purpose: z.string().min(5).max(400),
      candidateFactReferences: z.array(z.string()).default([]),
      evidenceReferences: z.array(z.string()).default([]),
      expectedEvidence: z.array(z.string().min(2)).min(1),
      allowedProbeTypes: z.array(z.enum(PROBE_TYPES)).default(['CLARIFICATION', 'DEEP_DIVE']),
    })
  ),
});

module.exports = {
  QUESTION_TYPES,
  QUESTION_CATEGORIES,
  CONSISTENCY_CLASSES,
  DIFFICULTY_LEVELS,
  PROBE_TYPES,
  FollowUpPolicySchema,
  PlannedQuestionSchema,
  GeneratedQuestionsLlmSchema,
};
