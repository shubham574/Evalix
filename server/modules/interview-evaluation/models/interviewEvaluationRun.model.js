const mongoose = require('mongoose');

const EVALUATION_RUN_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'PARTIALLY_EVALUATED',
  'COMPLETED',
  'COMPLETED_WITH_WARNINGS',
  'INSUFFICIENT_COVERAGE',
  'NEEDS_REVIEW',
  'FAILED',
  'SUPERSEDED',
];

const interviewEvaluationRunSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    sessionUuid: {
      type: String,
      required: true,
      index: true,
    },
    intakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewIntake',
      required: true,
      index: true,
    },
    candidateProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateProfile',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    blueprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewBlueprint',
      required: true,
    },
    blueprintVersion: {
      type: Number,
      required: true,
    },
    evaluationVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    evaluatorVersion: {
      type: String,
      required: true,
      default: '6.0.0',
    },
    schemaVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: EVALUATION_RUN_STATUSES,
      default: 'QUEUED',
      index: true,
    },
    sessionSnapshotChecksum: {
      type: String,
      required: true,
    },
    evaluationSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    coverageSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reviewStatus: {
      type: String,
      enum: ['PENDING_REVIEW', 'ACCEPTED', 'REVIEW_REQUESTED', 'ADJUSTED', 'APPROVED'],
      default: 'PENDING_REVIEW',
    },
    latestReviewVersion: {
      type: Number,
      default: 0,
    },
    retryReason: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failureCode: {
      type: String,
      default: null,
    },
    failureMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'interview_evaluation_runs',
  }
);

interviewEvaluationRunSchema.index(
  { sessionId: 1, evaluationVersion: -1 },
  { unique: true }
);
interviewEvaluationRunSchema.index({ sessionUuid: 1, evaluationVersion: -1 });

module.exports = {
  InterviewEvaluationRun: mongoose.model('InterviewEvaluationRun', interviewEvaluationRunSchema),
  EVALUATION_RUN_STATUSES,
};
