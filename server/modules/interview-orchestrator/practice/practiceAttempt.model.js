const mongoose = require('mongoose');

const practiceAttemptSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    questionId: {
      type: String,
      required: true,
      index: true,
    },
    competencyId: {
      type: String,
      default: null,
    },
    stageId: {
      type: String,
      default: null,
    },
    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    idempotencyKey: {
      type: String,
      required: true,
    },
    answerText: {
      type: String,
      required: true,
    },
    transcriptStatus: {
      type: String,
      enum: ['FINAL'],
      default: 'FINAL',
    },
    feedback: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    isSelectedForEvaluation: {
      type: Boolean,
      default: false,
    },
    turnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewTurn',
      default: null,
    },
  },
  { timestamps: true }
);

practiceAttemptSchema.index({ sessionId: 1, idempotencyKey: 1 }, { unique: true });
practiceAttemptSchema.index({ sessionId: 1, questionId: 1, attemptNumber: 1 }, { unique: true });

const PracticeAttempt = mongoose.model('PracticeAttempt', practiceAttemptSchema);

module.exports = PracticeAttempt;
