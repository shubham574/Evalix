const mongoose = require('mongoose');

const ANALYSIS_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'AWAITING_CANDIDATE_REVIEW',
  'READY_FOR_INTERVIEW_PLANNING',
  'NEEDS_REVIEW',
  'PARTIALLY_COMPLETED',
  'FAILED',
  'SUPERSEDED',
];

const CandidateJobAnalysisSchema = new mongoose.Schema(
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
    targetJobProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TargetJobProfile',
      required: true,
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
    analysisVersion: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    schemaVersion: {
      type: String,
      required: true,
      default: '1.0',
    },
    analysisStatus: {
      type: String,
      required: true,
      enum: ANALYSIS_STATUSES,
      default: 'QUEUED',
      index: true,
    },
    candidateProfileSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reviewedProfileSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    jobRequirementSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    experienceAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    summary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    interviewFocusAreas: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    validationWarnings: {
      type: [String],
      default: [],
    },
    sourceVersions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    reviewedCompletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'candidate_job_analyses',
  }
);

CandidateJobAnalysisSchema.index(
  { intakeId: 1, analysisVersion: -1 },
  { unique: true, name: 'uniq_analysis_intake_version' }
);
CandidateJobAnalysisSchema.index(
  { intakeId: 1, resumeExtractionId: 1, jobDescriptionExtractionId: 1, schemaVersion: 1 },
  { name: 'idx_analysis_source_extractions' }
);
CandidateJobAnalysisSchema.index({ candidateProfileId: 1, createdAt: -1 });

module.exports = {
  CandidateJobAnalysis: mongoose.model('CandidateJobAnalysis', CandidateJobAnalysisSchema),
  ANALYSIS_STATUSES,
};
