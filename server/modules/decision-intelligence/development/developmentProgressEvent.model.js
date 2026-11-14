const mongoose = require('mongoose');

const PROGRESS_ACTIONS = [
  'STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'REVISITED',
  'MARKED_FOR_REVIEW',
];

const developmentProgressEventSchema = new mongoose.Schema(
  {
    developmentPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateDevelopmentPlan', required: true, index: true },
    candidateProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateProfile', required: true, index: true },
    userId: { type: String, required: true, index: true },
    objectiveId: { type: String, required: true },
    action: { type: String, enum: PROGRESS_ACTIONS, required: true },
    progressStatus: { type: String, required: true },
    candidateNotes: { type: String, default: '', maxlength: 1000 },
  },
  {
    timestamps: true,
    collection: 'development_progress_events',
  }
);

developmentProgressEventSchema.index({ developmentPlanId: 1, objectiveId: 1, createdAt: -1 });

module.exports = {
  DevelopmentProgressEvent: mongoose.model('DevelopmentProgressEvent', developmentProgressEventSchema),
  PROGRESS_ACTIONS,
};
