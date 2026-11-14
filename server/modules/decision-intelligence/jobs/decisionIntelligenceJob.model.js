const mongoose = require('mongoose');

const decisionIntelligenceJobSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    evaluationRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewEvaluationRun', required: true, index: true },
    organizationId: { type: String, default: null },
    jobType: {
      type: String,
      enum: ['STUDENT_LEARNING_INSIGHTS', 'DECISION_SUPPORT_REPORT', 'DEVELOPMENT_PLAN'],
      required: true,
    },
    idempotencyKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['QUEUED', 'PROCESSING', 'RETRY_WAIT', 'COMPLETED', 'FAILED'],
      default: 'QUEUED',
      index: true,
    },
    attemptCount: { type: Number, default: 0 },
    maximumAttempts: { type: Number, default: 3 },
    lockedBy: { type: String, default: null },
    lockedAt: { type: Date, default: null },
    leaseExpiresAt: { type: Date, default: null, index: true },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    failureStage: { type: String, default: null },
    lastErrorCode: { type: String, default: null },
    lastErrorMessage: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'decision_intelligence_jobs',
  }
);

decisionIntelligenceJobSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = {
  DecisionIntelligenceJob: mongoose.model('DecisionIntelligenceJob', decisionIntelligenceJobSchema),
};
