const mongoose = require('mongoose');

const keyClaimSchema = new mongoose.Schema(
  {
    claimId: { type: String, required: true },
    turnNumber: { type: Number, required: true },
    questionId: { type: String, default: null },
    competencyId: { type: String, default: null },
    summary: { type: String, required: true },
    technologies: { type: [String], default: [] },
    verifiedByFollowUp: { type: Boolean, default: false },
  },
  { _id: false }
);

const competencyCoverageSchema = new mongoose.Schema(
  {
    competencyId: { type: String, required: true },
    competencyName: { type: String, default: '' },
    questionsAsked: { type: Number, default: 0 },
    followUpsAsked: { type: Number, default: 0 },
    signalsObserved: { type: [String], default: [] },
  },
  { _id: false }
);

const recentTurnWindowSchema = new mongoose.Schema(
  {
    turnNumber: { type: Number, required: true },
    speaker: { type: String, required: true },
    questionId: { type: String, default: null },
    textSnippet: { type: String, required: true },
  },
  { _id: false }
);

const sessionMemorySchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      unique: true,
      index: true,
    },
    snapshotVersion: {
      type: Number,
      default: 1,
    },
    lastTurnNumber: {
      type: Number,
      default: 0,
    },
    rollingSummary: {
      type: String,
      default: '',
    },
    keyClaims: {
      type: [keyClaimSchema],
      default: [],
    },
    candidateTopicsMentioned: {
      type: [String],
      default: [],
    },
    competencyCoverage: {
      type: [competencyCoverageSchema],
      default: [],
    },
    openFollowUpThreads: {
      type: [
        {
          questionId: String,
          reason: String,
          priority: { type: Number, default: 1 },
        },
      ],
      default: [],
    },
    recentTurnWindow: {
      type: [recentTurnWindowSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'interview_session_memory',
  }
);

module.exports = mongoose.model('SessionMemory', sessionMemorySchema);
