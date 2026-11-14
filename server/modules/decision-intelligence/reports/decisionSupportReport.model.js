/**
 * @deprecated Module 7 Refactor: Replaced by `StudentPracticeReport` (`student_practice_reports`)
 * for student-facing interview coaching & practice insights. Historical collection preserved.
 */
const mongoose = require('mongoose');

const DECISION_SUPPORT_STATUSES = [
  'STRONG_EVIDENCE_OF_REQUIREMENT_COVERAGE',
  'MIXED_EVIDENCE',
  'LIMITED_EVIDENCE',
  'INSUFFICIENT_ASSESSMENT_COVERAGE',
  'REVIEW_REQUIRED',
];

const decisionSupportReportSchema = new mongoose.Schema(
  {
    intakeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewIntake', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    sessionUuid: { type: String, required: true, index: true },
    candidateProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateProfile', required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    evaluationRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewEvaluationRun', required: true, index: true },
    evaluationVersion: { type: Number, required: true },
    blueprintVersion: { type: Number, required: true },
    reportVersion: { type: Number, required: true, default: 1 },
    humanReviewStatus: { type: String, required: true },
    reviewStateLabel: {
      type: String,
      enum: ['AI_ONLY', 'AWAITING_REVIEW', 'HUMAN_REVIEWED'],
      required: true,
    },
    decisionSupportStatus: {
      type: String,
      enum: DECISION_SUPPORT_STATUSES,
      required: true,
    },
    professionalOverview: { type: mongoose.Schema.Types.Mixed, default: {} },
    assessmentSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    requirementInsights: { type: [mongoose.Schema.Types.Mixed], default: [] },
    strengths: { type: [mongoose.Schema.Types.Mixed], default: [] },
    developmentAreas: { type: [mongoose.Schema.Types.Mixed], default: [] },
    coverageSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    clarificationItems: { type: [mongoose.Schema.Types.Mixed], default: [] },
    qualityFlags: { type: [String], default: [] },
    sourceVersions: { type: mongoose.Schema.Types.Mixed, default: {} },
    narrativeSummary: { type: String, default: '' },
    llmMetadata: { type: mongoose.Schema.Types.Mixed, default: null },
    generationStatus: {
      type: String,
      enum: ['GENERATED', 'SUPERSEDED', 'FAILED'],
      default: 'GENERATED',
    },
  },
  {
    timestamps: true,
    collection: 'recruiter_decision_support_reports',
  }
);

decisionSupportReportSchema.index(
  { sessionId: 1, organizationId: 1, reportVersion: -1 },
  { unique: true }
);
decisionSupportReportSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = {
  DecisionSupportReport: mongoose.model('DecisionSupportReport', decisionSupportReportSchema),
  DECISION_SUPPORT_STATUSES,
};
