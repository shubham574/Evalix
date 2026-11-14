const mongoose = require('mongoose');

const evaluationCalibrationSummarySchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    competencyId: { type: String, required: true },
    rubricVersion: { type: String, default: '1.0' },
    evaluatorVersion: { type: String, default: '6.0.0' },
    sampleCount: { type: Number, required: true },
    averageScoreDifference: { type: Number, required: true },
    meanAbsoluteDifference: { type: Number, required: true },
    reviewerOverrideRate: { type: Number, required: true },
    agreementStatistics: { type: mongoose.Schema.Types.Mixed, default: {} },
    reportVersion: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    collection: 'evaluation_calibration_summaries',
  }
);

evaluationCalibrationSummarySchema.index(
  { organizationId: 1, competencyId: 1, rubricVersion: 1, evaluatorVersion: 1 },
  { unique: true }
);

module.exports = {
  EvaluationCalibrationSummary: mongoose.model('EvaluationCalibrationSummary', evaluationCalibrationSummarySchema),
};
