const mongoose = require('mongoose');

const evaluationQualityReportSchema = new mongoose.Schema(
  {
    evaluationRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewEvaluationRun', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    qualityCheckVersion: { type: Number, required: true, default: 1 },
    integrityChecks: { type: mongoose.Schema.Types.Mixed, default: {} },
    coverageChecks: { type: mongoose.Schema.Types.Mixed, default: {} },
    scoringChecks: { type: mongoose.Schema.Types.Mixed, default: {} },
    evidenceChecks: { type: mongoose.Schema.Types.Mixed, default: {} },
    interviewerChecks: { type: mongoose.Schema.Types.Mixed, default: {} },
    qualityFlags: { type: [String], default: [] },
    qualityStatus: {
      type: String,
      enum: ['PASSED', 'PASSED_WITH_WARNINGS', 'FAILED'],
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'evaluation_quality_reports',
  }
);

evaluationQualityReportSchema.index(
  { evaluationRunId: 1, qualityCheckVersion: -1 },
  { unique: true }
);

module.exports = {
  EvaluationQualityReport: mongoose.model('EvaluationQualityReport', evaluationQualityReportSchema),
};
