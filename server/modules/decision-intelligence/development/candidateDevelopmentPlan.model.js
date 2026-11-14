const mongoose = require('mongoose');

const candidateDevelopmentPlanSchema = new mongoose.Schema(
  {
    candidateProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateProfile', required: true, index: true },
    userId: { type: String, required: true, index: true },
    intakeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewIntake', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    sessionUuid: { type: String, required: true, index: true },
    evaluationRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewEvaluationRun', required: true, index: true },
    planVersion: { type: Number, required: true, default: 1 },
    previousPlanVersion: { type: Number, default: null },
    practiceMode: {
      type: String,
      enum: ['REALISTIC_MOCK', 'GUIDED_PRACTICE', 'FOCUSED_SKILL_PRACTICE'],
      default: 'REALISTIC_MOCK',
    },
    targetRole: { type: String, default: '' },
    targetCompetencyIds: { type: [String], default: [] },
    sourceQuestionIds: { type: [String], default: [] },
    sourceEvaluationVersion: { type: Number, default: 1 },
    planTitle: { type: String, default: '' },
    overallObjective: { type: String, default: '' },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUPERSEDED', 'COMPLETED'],
      default: 'ACTIVE',
    },
    planStatus: {
      type: String,
      enum: ['ACTIVE', 'SUPERSEDED', 'COMPLETED'],
      default: 'ACTIVE',
    },
    summary: { type: String, default: '' },
    objectives: { type: [mongoose.Schema.Types.Mixed], default: [] },
    improvementObjectives: { type: [mongoose.Schema.Types.Mixed], default: [] },
    sourceEvaluationReferences: { type: [mongoose.Schema.Types.Mixed], default: [] },
    llmMetadata: { type: mongoose.Schema.Types.Mixed, default: null },
    generatedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'candidate_development_plans',
  }
);

candidateDevelopmentPlanSchema.index(
  { sessionId: 1, planVersion: -1 },
  { unique: true }
);
candidateDevelopmentPlanSchema.index({ candidateProfileId: 1, createdAt: -1 });

module.exports = {
  CandidateDevelopmentPlan: mongoose.model('CandidateDevelopmentPlan', candidateDevelopmentPlanSchema),
};
