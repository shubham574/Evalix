const mongoose = require('mongoose');

const QUESTION_EVALUATION_STATUSES = [
  'EVALUATED',
  'PARTIALLY_EVALUATED',
  'NOT_ASKED',
  'NOT_ANSWERED',
  'INTERRUPTED',
  'INVALID_TRANSCRIPT',
  'INSUFFICIENT_EVIDENCE',
  'EXCLUDED_BY_SESSION_POLICY',
];

const EVIDENCE_SUPPORT_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'];

const RATING_LABELS = {
  1: 'INSUFFICIENT',
  2: 'LIMITED',
  3: 'MEETS_EXPECTATION',
  4: 'STRONG',
  5: 'EXCELLENT',
};

const questionEvaluationSchema = new mongoose.Schema(
  {
    evaluationRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewEvaluationRun',
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    questionId: {
      type: String,
      required: true,
    },
    competencyId: {
      type: String,
      default: null,
    },
    rubricId: {
      type: String,
      default: null,
    },
    questionText: {
      type: String,
      default: '',
    },
    questionType: {
      type: String,
      default: 'TECHNICAL',
    },
    evaluationStatus: {
      type: String,
      enum: QUESTION_EVALUATION_STATUSES,
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    ratingLabel: {
      type: String,
      default: null,
    },
    evidenceSupport: {
      type: String,
      enum: EVIDENCE_SUPPORT_LEVELS,
      default: 'INSUFFICIENT',
    },
    criterionEvaluations: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    evidenceReferences: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    unverifiedEvidenceReferences: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    strengths: {
      type: [String],
      default: [],
    },
    developmentAreas: {
      type: [String],
      default: [],
    },
    missingEvidence: {
      type: [String],
      default: [],
    },
    promptingContext: {
      type: String,
      default: 'UNPROMPTED',
    },
    explanation: {
      type: String,
      default: '',
    },
    reviewRequired: {
      type: Boolean,
      default: false,
    },
    reviewFlags: {
      type: [String],
      default: [],
    },
    llmMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    humanOverride: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'question_evaluations',
  }
);

questionEvaluationSchema.index(
  { evaluationRunId: 1, questionId: 1 },
  { unique: true }
);

module.exports = {
  QuestionEvaluation: mongoose.model('QuestionEvaluation', questionEvaluationSchema),
  QUESTION_EVALUATION_STATUSES,
  EVIDENCE_SUPPORT_LEVELS,
  RATING_LABELS,
};
