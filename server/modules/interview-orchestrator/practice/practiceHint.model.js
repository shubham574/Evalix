const mongoose = require('mongoose');

const HINT_TYPES = ['LIGHT', 'STRUCTURE', 'CONCEPT'];

const practiceHintSchema = new mongoose.Schema(
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
    hintLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
    },
    hintType: {
      type: String,
      enum: HINT_TYPES,
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
    },
    hintText: {
      type: String,
      required: true,
    },
    promptVersion: {
      type: String,
      default: '8.0.0',
    },
  },
  { timestamps: true }
);

practiceHintSchema.index({ sessionId: 1, idempotencyKey: 1 }, { unique: true });
practiceHintSchema.index({ sessionId: 1, questionId: 1, hintLevel: 1 }, { unique: true });

const PracticeHint = mongoose.model('PracticeHint', practiceHintSchema);

module.exports = {
  PracticeHint,
  HINT_TYPES,
};
