const mongoose = require('mongoose');

const stageProgressSchema = new mongoose.Schema(
  {
    stageId: { type: String, required: true },
    stageType: { type: String, required: true },
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED'],
      default: 'PENDING',
    },
    allocatedDurationSeconds: { type: Number, default: 0 },
    elapsedSeconds: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    questionIds: { type: [String], default: [] },
    askedQuestionIds: { type: [String], default: [] },
    completedQuestionIds: { type: [String], default: [] },
  },
  { _id: false }
);

const activePromptSchema = new mongoose.Schema(
  {
    turnNumber: { type: Number, default: 0 },
    stageId: { type: String, default: null },
    questionId: { type: String, default: null },
    competencyId: { type: String, default: null },
    isFollowUp: { type: Boolean, default: false },
    text: { type: String, default: '' },
    startedAt: { type: Date, default: null },
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      default: null,
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
    },
    candidateAnalysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateAnalysis',
      required: true,
    },
    blueprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewBlueprint',
      required: true,
      index: true,
    },
    blueprintVersion: {
      type: Number,
      required: true,
    },
    blueprintChecksum: {
      type: String,
      required: true,
    },
    interviewType: {
      type: String,
      required: true,
    },
    practiceMode: {
      type: String,
      enum: ['REALISTIC_MOCK', 'GUIDED_PRACTICE', 'FOCUSED_SKILL_PRACTICE'],
      default: 'REALISTIC_MOCK',
    },
    targetRole: {
      type: String,
      required: true,
    },
    seniorityLevel: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'CREATED',
        'READY',
        'IN_PROGRESS',
        'PAUSED',
        'COMPLETING',
        'COMPLETED',
        'ABANDONED',
        'FAILED',
      ],
      default: 'CREATED',
      index: true,
    },
    stateVersion: {
      type: Number,
      default: 0,
    },
    consentRequired: {
      type: Boolean,
      default: true,
    },
    consentGranted: {
      type: Boolean,
      default: false,
    },
    consentRecordedAt: {
      type: Date,
      default: null,
    },
    currentStageId: {
      type: String,
      default: null,
    },
    currentStageIndex: {
      type: Number,
      default: 0,
    },
    currentQuestionId: {
      type: String,
      default: null,
    },
    currentQuestionIndex: {
      type: Number,
      default: -1,
    },
    currentFollowUpCount: {
      type: Number,
      default: 0,
    },
    totalTurnCount: {
      type: Number,
      default: 0,
    },
    lastCompletedTurnNumber: {
      type: Number,
      default: 0,
    },
    stageProgress: {
      type: [stageProgressSchema],
      default: [],
    },
    askedQuestionIds: {
      type: [String],
      default: [],
    },
    completedQuestionIds: {
      type: [String],
      default: [],
    },
    skippedQuestionIds: {
      type: [String],
      default: [],
    },
    coveredCompetencyIds: {
      type: [String],
      default: [],
    },
    followUpsPerQuestion: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    activePrompt: {
      type: activePromptSchema,
      default: () => ({}),
    },
    focusedCompetencyId: {
      type: String,
      default: null,
      index: true,
    },
    executionSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    guidedState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    totalDurationSeconds: {
      type: Number,
      required: true,
    },
    activeDurationSeconds: {
      type: Number,
      default: 0,
    },
    pausedDurationSeconds: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: null,
    },
    pausedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    abandonedAt: {
      type: Date,
      default: null,
    },
    terminationReason: {
      type: String,
      default: null,
    },
    failureCode: {
      type: String,
      default: null,
    },
    failureMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'interview_sessions',
  }
);

interviewSessionSchema.index({ intakeId: 1, createdAt: -1 });
interviewSessionSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
