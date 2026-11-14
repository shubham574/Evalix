const mongoose = require('mongoose');

const interviewTurnSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    turnNumber: {
      type: Number,
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
    },
    speaker: {
      type: String,
      enum: ['AI', 'CANDIDATE', 'SYSTEM'],
      required: true,
    },
    turnType: {
      type: String,
      enum: [
        'OPENING',
        'CONSENT',
        'CORE_QUESTION',
        'FOLLOW_UP',
        'TRANSITION',
        'CLARIFICATION',
        'CANDIDATE_ANSWER',
        'INTERRUPTION',
        'CLOSING',
        'SYSTEM_RECOVERY',
      ],
      required: true,
    },
    stageId: {
      type: String,
      default: null,
    },
    questionId: {
      type: String,
      default: null,
    },
    competencyId: {
      type: String,
      default: null,
    },
    spokenText: {
      type: String,
      default: '',
    },
    rawTranscript: {
      type: String,
      default: '',
    },
    transcriptStatus: {
      type: String,
      enum: ['NONE', 'PARTIAL', 'FINAL', 'CONFIRMED', 'EMPTY'],
      default: 'NONE',
    },
    processingStatus: {
      type: String,
      enum: [
        'RECEIVED',
        'PROCESSING',
        'PROCESSED',
        'TTS_PENDING',
        'TTS_FAILED',
        'COMPLETED',
        'IGNORED',
        'FAILED',
      ],
      default: 'RECEIVED',
    },
    interrupted: {
      type: Boolean,
      default: false,
    },
    interruptedAtMs: {
      type: Number,
      default: null,
    },
    sttMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ttsMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    adaptiveDecision: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    llmMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'interview_turns',
  }
);

interviewTurnSchema.index({ sessionId: 1, turnNumber: 1 }, { unique: true });
interviewTurnSchema.index({ sessionId: 1, idempotencyKey: 1 }, { unique: true });
interviewTurnSchema.index({ sessionId: 1, stageId: 1, questionId: 1 });

module.exports = mongoose.model('InterviewTurn', interviewTurnSchema);
