const mongoose = require('mongoose');

const interviewEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    intakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewIntake',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'SESSION_CREATED',
        'SESSION_READY',
        'SESSION_STARTED',
        'CONSENT_RECORDED',
        'STAGE_TRANSITIONED',
        'QUESTION_ASKED',
        'FOLLOW_UP_ASKED',
        'TURN_PROCESSED',
        'TTS_FAILED',
        'TTS_RETRIED',
        'TTS_INTERRUPTED',
        'SESSION_PAUSED',
        'SESSION_RESUMED',
        'SESSION_ABANDONED',
        'SESSION_FAILED',
        'INTERVIEW_SESSION_COMPLETED',
      ],
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    outboxStatus: {
      type: String,
      enum: ['INTERNAL', 'PENDING_DISPATCH', 'DISPATCHED', 'FAILED'],
      default: 'INTERNAL',
      index: true,
    },
    dispatchedAt: {
      type: Date,
      default: null,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'interview_session_events',
  }
);

interviewEventSchema.index({ sessionId: 1, occurredAt: 1 });
interviewEventSchema.index({ eventType: 1, outboxStatus: 1, occurredAt: 1 });

module.exports = mongoose.model('InterviewEvent', interviewEventSchema);
