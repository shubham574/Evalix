const mongoose = require('mongoose');

const EXTRACTION_STATUSES = [
  'COMPLETED',
  'COMPLETED_WITH_WARNINGS',
  'PARTIAL',
  'OCR_REQUIRED',
  'FAILED',
];

const DocumentExtractionSchema = new mongoose.Schema(
  {
    documentId: {
      type: String,
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
    documentChecksum: {
      type: String,
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      enum: ['RESUME', 'JOB_DESCRIPTION'],
    },
    parserVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    extractorVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    promptVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    schemaVersion: {
      type: String,
      required: true,
      default: '1.0',
    },
    provider: {
      type: String,
      default: null,
    },
    model: {
      type: String,
      default: null,
    },
    extractionStatus: {
      type: String,
      required: true,
      enum: EXTRACTION_STATUSES,
    },
    extractedData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    sourceEvidence: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    validationWarnings: {
      type: [String],
      default: [],
    },
    parserMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    tokenUsage: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'document_extractions',
  }
);

DocumentExtractionSchema.index(
  { documentId: 1, documentChecksum: 1, extractorVersion: 1, schemaVersion: 1 },
  { unique: true, name: 'uniq_doc_extraction_idempotency' }
);

module.exports = {
  DocumentExtraction: mongoose.model('DocumentExtraction', DocumentExtractionSchema),
  EXTRACTION_STATUSES,
};
