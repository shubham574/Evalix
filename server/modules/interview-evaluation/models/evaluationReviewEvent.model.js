const mongoose = require('mongoose');

const REVIEW_ACTIONS = [
  'ACCEPT',
  'REQUEST_REVIEW',
  'ADJUST_SCORE',
  'FLAG_INVALID',
  'APPROVE_REPORT',
];

const evaluationReviewEventSchema = new mongoose.Schema(
  {
    evaluationRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewEvaluationRun',
      required: true,
      index: true,
    },
    reviewerId: {
      type: String,
      required: true,
    },
    targetType: {
      type: String,
      enum: ['RUN', 'QUESTION', 'COMPETENCY', 'REPORT'],
      required: true,
    },
    targetId: {
      type: String,
      required: true,
    },
    originalScore: {
      type: Number,
      default: null,
    },
    revisedScore: {
      type: Number,
      default: null,
    },
    reviewAction: {
      type: String,
      enum: REVIEW_ACTIONS,
      required: true,
    },
    justification: {
      type: String,
      required: true,
    },
    reviewVersion: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'evaluation_review_events',
  }
);

evaluationReviewEventSchema.index(
  { evaluationRunId: 1, reviewVersion: 1 },
  { unique: true }
);

module.exports = {
  EvaluationReviewEvent: mongoose.model('EvaluationReviewEvent', evaluationReviewEventSchema),
  REVIEW_ACTIONS,
};
