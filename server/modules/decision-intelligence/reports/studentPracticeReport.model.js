const mongoose = require('mongoose');

const PRACTICE_MODES = ['REALISTIC_MOCK', 'GUIDED_PRACTICE', 'FOCUSED_SKILL_PRACTICE'];
const REPORT_STATUSES = [
  'STRONG_PREPARATION_EVIDENCE',
  'MIXED_PRACTICE_EVIDENCE',
  'NEEDS_TARGETED_PRACTICE',
  'INSUFFICIENT_ASSESSMENT_COVERAGE',
  'REVIEW_REQUIRED',
];

const studentPracticeReportSchema = new mongoose.Schema(
  {
    candidateProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateProfile', required: true, index: true },
    userId: { type: String, required: true, index: true },
    intakeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewIntake', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    sessionUuid: { type: String, required: true, index: true },
    evaluationRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewEvaluationRun', required: true, index: true },
    practiceMode: { type: String, enum: PRACTICE_MODES, default: 'REALISTIC_MOCK' },
    focusedCompetencyId: { type: String, default: null },
    targetRole: { type: String, default: '' },
    reportVersion: { type: Number, required: true, default: 1 },
    reportStatus: { type: String, enum: REPORT_STATUSES, required: true },
    reviewStateLabel: {
      type: String,
      enum: ['AI_ONLY', 'AWAITING_REVIEW', 'HUMAN_REVIEWED'],
      required: true,
    },
    overallPracticeScore: { type: Number, default: null },
    assessmentCoverage: { type: Number, default: 0 },
    practiceSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    strengths: { type: [mongoose.Schema.Types.Mixed], default: [] },
    developmentAreas: { type: [mongoose.Schema.Types.Mixed], default: [] },
    questionFeedback: { type: [mongoose.Schema.Types.Mixed], default: [] },
    answerImprovementGuidance: { type: [mongoose.Schema.Types.Mixed], default: [] },
    competencyInsights: { type: [mongoose.Schema.Types.Mixed], default: [] },
    preparationCoverage: { type: [mongoose.Schema.Types.Mixed], default: [] },
    performancePatterns: { type: [mongoose.Schema.Types.Mixed], default: [] },
    recommendedNextPractice: { type: mongoose.Schema.Types.Mixed, default: {} },
    dataQualityWarnings: { type: [mongoose.Schema.Types.Mixed], default: [] },
    sourceVersions: { type: mongoose.Schema.Types.Mixed, default: {} },
    coachingSummary: { type: String, default: '' },
    llmMetadata: { type: mongoose.Schema.Types.Mixed, default: null },
    generationStatus: {
      type: String,
      enum: ['GENERATED', 'SUPERSEDED', 'FAILED'],
      default: 'GENERATED',
    },
  },
  {
    timestamps: true,
    collection: 'student_practice_reports',
  }
);

studentPracticeReportSchema.index({ sessionId: 1, reportVersion: -1 }, { unique: true });
studentPracticeReportSchema.index({ candidateProfileId: 1, createdAt: -1 });
studentPracticeReportSchema.index({ userId: 1, createdAt: -1 });

module.exports = {
  StudentPracticeReport: mongoose.model('StudentPracticeReport', studentPracticeReportSchema),
  PRACTICE_MODES,
  REPORT_STATUSES,
};
