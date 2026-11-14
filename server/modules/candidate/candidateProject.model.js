const mongoose = require('mongoose');

const CandidateProjectSchema = new mongoose.Schema(
  {
    candidateProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateProfile',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    projectTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    projectDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    technologies: {
      type: [String],
      default: [],
    },
    projectUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    candidateResponsibility: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'candidate_projects',
  }
);

CandidateProjectSchema.index({ candidateProfileId: 1, createdAt: -1 });

module.exports = {
  CandidateProject: mongoose.model('CandidateProject', CandidateProjectSchema),
};
