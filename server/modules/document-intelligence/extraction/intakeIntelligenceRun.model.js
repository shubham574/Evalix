const mongoose = require('mongoose');

const RUN_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PARTIALLY_COMPLETED',
  'COMPLETED',
  'COMPLETED_WITH_WARNINGS',
  'FAILED',
  'NEEDS_REVIEW',
];

const IntakeIntelligenceRunSchema = new mongoose.Schema(
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
    resumeDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateDocument',
      required: true,
    },
    resumeChecksum: {
      type: String,
      required: true,
    },
    jobDescriptionSourceKey: {
      type: String,
      required: true,
    },
    jobDescriptionDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateDocument',
      default: null,
    },
    resumeExtractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentExtraction',
      default: null,
    },
    jobDescriptionExtractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentExtraction',
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: RUN_STATUSES,
      default: 'PENDING',
      index: true,
    },
    completionSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    validationWarnings: {
      type: [String],
      default: [],
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
    collection: 'intake_intelligence_runs',
  }
);

IntakeIntelligenceRunSchema.index(
  { intakeId: 1, resumeDocumentId: 1, resumeChecksum: 1, jobDescriptionSourceKey: 1 },
  { unique: true, name: 'uniq_intake_intelligence_run_versions' }
);

module.exports = {
  IntakeIntelligenceRun: mongoose.model('IntakeIntelligenceRun', IntakeIntelligenceRunSchema),
  RUN_STATUSES,
};
