const mongoose = require('mongoose');

const JOB_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'RETRY_WAIT',
  'COMPLETED',
  'FAILED',
  'NEEDS_OCR',
  'BLOCKED_SECURITY_SCAN',
  'REJECTED',
];

const TERMINAL_NON_RETRYABLE = new Set(['COMPLETED', 'NEEDS_OCR', 'BLOCKED_SECURITY_SCAN', 'REJECTED']);

const DocumentExtractionJobSchema = new mongoose.Schema(
  {
    intakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewIntake',
      required: true,
      index: true,
    },
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IntakeIntelligenceRun',
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
    documentId: {
      type: String,
      required: true,
      index: true,
    },
    sourceKind: {
      type: String,
      required: true,
      enum: ['DOCUMENT', 'TEXT'],
      default: 'DOCUMENT',
    },
    documentType: {
      type: String,
      required: true,
      enum: ['RESUME', 'JOB_DESCRIPTION'],
    },
    documentChecksum: {
      type: String,
      required: true,
    },
    extractorVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    schemaVersion: {
      type: String,
      required: true,
      default: '1.0',
    },
    status: {
      type: String,
      required: true,
      enum: JOB_STATUSES,
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
    nextAttemptAt: {
      type: Date,
      default: () => new Date(),
      index: true,
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
    lastErrorCode: {
      type: String,
      default: null,
    },
    lastErrorMessage: {
      type: String,
      default: null,
    },
    extractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentExtraction',
      default: null,
    },
    lastManualRetryAt: {
      type: Date,
      default: null,
    },
    retryHistory: {
      type: [
        {
          retriedAt: Date,
          reason: String,
          triggeredBy: String,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'document_extraction_jobs',
  }
);

DocumentExtractionJobSchema.index(
  { intakeId: 1, documentId: 1, documentChecksum: 1, extractorVersion: 1, schemaVersion: 1 },
  { unique: true, name: 'uniq_extraction_job_idempotency' }
);
DocumentExtractionJobSchema.index({ status: 1, nextAttemptAt: 1 });
DocumentExtractionJobSchema.index({ status: 1, leaseExpiresAt: 1 });

module.exports = {
  DocumentExtractionJob: mongoose.model('DocumentExtractionJob', DocumentExtractionJobSchema),
  JOB_STATUSES,
  TERMINAL_NON_RETRYABLE,
};
