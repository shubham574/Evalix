const mongoose = require('mongoose');

const interviewReportSchema = new mongoose.Schema(
  {
    evaluationRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewEvaluationRun',
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    reportVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    candidateReport: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    recruiterReport: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    visibilitySettings: {
      exposeCandidateScores: { type: Boolean, default: false },
    },
    generationStatus: {
      type: String,
      enum: ['GENERATED', 'REVIEWED', 'APPROVED', 'FAILED'],
      default: 'GENERATED',
    },
  },
  {
    timestamps: true,
    collection: 'interview_reports',
  }
);

interviewReportSchema.index(
  { evaluationRunId: 1, reportVersion: -1 },
  { unique: true }
);

module.exports = {
  InterviewReport: mongoose.model('InterviewReport', interviewReportSchema),
};
