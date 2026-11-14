const mongoose = require('mongoose');

const EVALUATION_JOB_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'RETRY_WAIT',
  'COMPLETED',
  'FAILED',
];

const interviewEvaluationJobSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    evaluationRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewEvaluationRun',
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: EVALUATION_JOB_STATUSES,
      default: 'QUEUED',
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    maximumAttempts: {
      type: Number,
      default: 3,
    },
    lockedBy: {
      type: String,
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    leaseExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    failureStage: {
      type: String,
      default: null,
    },
    lastErrorCode: {
      type: String,
      default: null,
    },
    lastErrorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'interview_evaluation_jobs',
  }
);

interviewEvaluationJobSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = {
  InterviewEvaluationJob: mongoose.model('InterviewEvaluationJob', interviewEvaluationJobSchema),
  EVALUATION_JOB_STATUSES,
};
