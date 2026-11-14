const mongoose = require('mongoose');

const COMPETENCY_ASSESSMENT_STATUSES = [
  'ASSESSED',
  'PARTIALLY_ASSESSED',
  'NOT_ASSESSED',
  'INSUFFICIENT_EVIDENCE',
  'REVIEW_REQUIRED',
];

const competencyEvaluationSchema = new mongoose.Schema(
  {
    evaluationRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewEvaluationRun',
      required: true,
      index: true,
    },
    competencyId: {
      type: String,
      required: true,
    },
    competencyName: {
      type: String,
      required: true,
    },
    weight: {
      type: Number,
      default: null,
    },
    assessmentStatus: {
      type: String,
      enum: COMPETENCY_ASSESSMENT_STATUSES,
      required: true,
    },
    score: {
      type: Number,
      default: null,
    },
    scoreScale: {
      type: Number,
      default: 5,
    },
    aggregationMethod: {
      type: String,
      default: 'EQUAL_WEIGHT',
    },
    evidenceSupport: {
      type: String,
      default: 'INSUFFICIENT',
    },
    questionScores: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    coverage: {
      plannedQuestions: { type: Number, default: 0 },
      evaluatedQuestions: { type: Number, default: 0 },
    },
    strengths: {
      type: [String],
      default: [],
    },
    developmentAreas: {
      type: [String],
      default: [],
    },
    evidenceReferences: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    humanOverride: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'competency_evaluations',
  }
);

competencyEvaluationSchema.index(
  { evaluationRunId: 1, competencyId: 1 },
  { unique: true }
);

module.exports = {
  CompetencyEvaluation: mongoose.model('CompetencyEvaluation', competencyEvaluationSchema),
  COMPETENCY_ASSESSMENT_STATUSES,
};
