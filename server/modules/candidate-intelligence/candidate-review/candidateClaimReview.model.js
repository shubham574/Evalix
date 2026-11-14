const mongoose = require('mongoose');

const CANDIDATE_ACTIONS = [
  'CONFIRM',
  'CORRECT',
  'DISPUTE',
  'ADD_MISSING_INFORMATION',
  'MARK_NOT_MINE',
];

const CLAIM_SOURCE_TYPES = [
  'RESUME_EXTRACTED',
  'CANDIDATE_ENTERED',
  'CANDIDATE_CONFIRMED',
  'CANDIDATE_CORRECTED',
];

const CandidateClaimReviewSchema = new mongoose.Schema(
  {
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateJobAnalysis',
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
    claimId: {
      type: String,
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      required: true,
      enum: CLAIM_SOURCE_TYPES,
    },
    resultingSourceType: {
      type: String,
      required: true,
      enum: CLAIM_SOURCE_TYPES,
    },
    originalValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    candidateAction: {
      type: String,
      required: true,
      enum: CANDIDATE_ACTIONS,
    },
    correctedValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
    sourceEvidenceReferences: {
      type: [String],
      default: [],
    },
    reviewVersion: {
      type: Number,
      required: true,
      min: 1,
    },
    reviewedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'candidate_claim_reviews',
  }
);

CandidateClaimReviewSchema.index(
  { analysisId: 1, claimId: 1, reviewVersion: -1 },
  { unique: true, name: 'uniq_claim_review_version' }
);
CandidateClaimReviewSchema.index({ candidateProfileId: 1, createdAt: -1 });

module.exports = {
  CandidateClaimReview: mongoose.model('CandidateClaimReview', CandidateClaimReviewSchema),
  CANDIDATE_ACTIONS,
  CLAIM_SOURCE_TYPES,
};
