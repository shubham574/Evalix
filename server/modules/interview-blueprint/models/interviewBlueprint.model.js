const mongoose = require('mongoose');

const BLUEPRINT_STATUSES = [
  'QUEUED',
  'GENERATING',
  'READY',
  'NEEDS_REVIEW',
  'FAILED',
  'SUPERSEDED',
  'ARCHIVED',
];

const InterviewBlueprintSchema = new mongoose.Schema(
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
      index: true,
    },
    blueprintVersion: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      required: true,
      enum: BLUEPRINT_STATUSES,
      default: 'QUEUED',
      index: true,
    },
    isLockedForSession: {
      type: Boolean,
      default: false,
    },
    interviewType: {
      type: String,
      required: true,
      enum: ['TECHNICAL', 'BEHAVIOURAL', 'MIXED', 'ROLE_SPECIFIC'],
      default: 'MIXED',
    },
    targetRole: {
      type: String,
      required: true,
    },
    roleFamily: {
      type: String,
      default: 'GENERAL',
    },
    seniorityLevel: {
      type: String,
      default: 'MID',
    },
    totalDurationSeconds: {
      type: Number,
      required: true,
      min: 300,
    },
    competencyPlan: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    excludedRequirements: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    stages: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    questionPlan: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    evaluationRubrics: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    rubricReferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    planningConfigurationVersion: {
      type: String,
      default: '1.0.0',
    },
    promptVersions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    modelMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sourceVersions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    generationWarnings: {
      type: [String],
      default: [],
    },
    regenerationReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'interview_blueprints',
  }
);

InterviewBlueprintSchema.index(
  { intakeId: 1, blueprintVersion: -1 },
  { unique: true, name: 'uniq_blueprint_intake_version' }
);
InterviewBlueprintSchema.index({ intakeId: 1, status: 1 });
InterviewBlueprintSchema.index({ candidateProfileId: 1, createdAt: -1 });

module.exports = {
  InterviewBlueprint: mongoose.model('InterviewBlueprint', InterviewBlueprintSchema),
  BLUEPRINT_STATUSES,
};
