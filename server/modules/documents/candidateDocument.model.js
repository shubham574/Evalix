const mongoose = require('mongoose');

const DOCUMENT_TYPES = ['RESUME', 'JOB_DESCRIPTION'];
const UPLOAD_STATUSES = ['PENDING', 'VALIDATED', 'FAILED', 'DELETED'];
const PROCESSING_STATUSES = ['PENDING_ANALYSIS', 'ANALYZED', 'FAILED'];
const SECURITY_STATUSES = ['SIGNATURE_VERIFIED_NO_AV', 'MALWARE_SCANNED_CLEAN', 'QUARANTINED'];

const CandidateDocumentSchema = new mongoose.Schema(
  {
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
    documentType: {
      type: String,
      required: true,
      enum: DOCUMENT_TYPES,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storedFilename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 1,
    },
    storageProvider: {
      type: String,
      required: true,
      default: 'local',
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    checksum: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    uploadStatus: {
      type: String,
      enum: UPLOAD_STATUSES,
      default: 'VALIDATED',
    },
    processingStatus: {
      type: String,
      enum: PROCESSING_STATUSES,
      default: 'PENDING_ANALYSIS',
    },
    securityStatus: {
      type: String,
      enum: SECURITY_STATUSES,
      default: 'SIGNATURE_VERIFIED_NO_AV',
    },
    retentionExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'candidate_documents',
  }
);

CandidateDocumentSchema.index({ candidateProfileId: 1, documentType: 1, checksum: 1, uploadStatus: 1 });

module.exports = {
  CandidateDocument: mongoose.model('CandidateDocument', CandidateDocumentSchema),
  DOCUMENT_TYPES,
  UPLOAD_STATUSES,
  PROCESSING_STATUSES,
  SECURITY_STATUSES,
};
