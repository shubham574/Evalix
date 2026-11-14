const mongoose = require('mongoose');

const evaluationCalibrationObservationSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    evaluationRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewEvaluationRun', required: true, index: true },
    questionEvaluationId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionEvaluation', default: null },
    competencyId: { type: String, required: true, index: true },
    questionType: { type: String, default: 'TECHNICAL' },
    originalAiScore: { type: Number, required: true },
    humanReviewedScore: { type: Number, required: true },
    scoreDifference: { type: Number, required: true },
    rubricVersion: { type: String, default: '1.0' },
    evaluatorVersion: { type: String, default: '6.0.0' },
    promptVersion: { type: String, default: 'module6.answer_evaluator.v1' },
    reviewReason: { type: String, default: '' },
    reviewEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationReviewEvent', required: true, unique: true },
  },
  {
    timestamps: true,
    collection: 'evaluation_calibration_observations',
  }
);

evaluationCalibrationObservationSchema.index({ organizationId: 1, competencyId: 1, evaluatorVersion: 1 });

module.exports = {
  EvaluationCalibrationObservation: mongoose.model('EvaluationCalibrationObservation', evaluationCalibrationObservationSchema),
};
