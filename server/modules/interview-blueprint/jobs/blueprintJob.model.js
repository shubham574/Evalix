const mongoose = require('mongoose');

const BLUEPRINT_JOB_STATUSES = ['QUEUED', 'PROCESSING', 'RETRY_WAIT', 'COMPLETED', 'FAILED'];

const BlueprintJobSchema = new mongoose.Schema(
  {
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
    candidateAnalysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateJobAnalysis',
      required: true,
    },
    blueprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewBlueprint',
      default: null,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: BLUEPRINT_JOB_STATUSES,
      default: 'QUEUED',
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maximumAttempts: {
      type: Number,
      default: 3,
      min: 1,
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
      default: () => new Date(),
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
    regenerationReason: {
      type: String,
      default: null,
    },
    requestedConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'interview_blueprint_jobs',
  }
);

BlueprintJobSchema.index({ status: 1, nextAttemptAt: 1 });
BlueprintJobSchema.index({ status: 1, leaseExpiresAt: 1 });

module.exports = {
  BlueprintJob: mongoose.model('BlueprintJob', BlueprintJobSchema),
  BLUEPRINT_JOB_STATUSES,
};
