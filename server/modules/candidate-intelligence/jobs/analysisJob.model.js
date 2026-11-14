const mongoose = require('mongoose');

const ANALYSIS_JOB_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'RETRY_WAIT',
  'COMPLETED',
  'FAILED',
];

const CandidateAnalysisJobSchema = new mongoose.Schema(
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
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateJobAnalysis',
      default: null,
    },
    resumeExtractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentExtraction',
      required: true,
    },
    jobDescriptionExtractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentExtraction',
      required: true,
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
      enum: ANALYSIS_JOB_STATUSES,
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
    collection: 'candidate_analysis_jobs',
  }
);

CandidateAnalysisJobSchema.index({ status: 1, nextAttemptAt: 1 });
CandidateAnalysisJobSchema.index({ status: 1, leaseExpiresAt: 1 });

module.exports = {
  CandidateAnalysisJob: mongoose.model('CandidateAnalysisJob', CandidateAnalysisJobSchema),
  ANALYSIS_JOB_STATUSES,
};
