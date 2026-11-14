const mongoose = require('mongoose');

const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE', 'HYBRID', 'ONSITE'];

const TargetJobProfileSchema = new mongoose.Schema(
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
    targetRole: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    targetCompany: {
      type: String,
      trim: true,
      maxlength: 160,
      default: null,
    },
    experienceRequired: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },
    jobDescriptionText: {
      type: String,
      trim: true,
      maxlength: 30000,
      default: '',
    },
    jobDescriptionDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateDocument',
      default: null,
    },
    jobLocation: {
      type: String,
      trim: true,
      maxlength: 160,
      default: null,
    },
    jobType: {
      type: String,
      enum: JOB_TYPES,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'target_job_profiles',
  }
);

TargetJobProfileSchema.index({ candidateProfileId: 1, createdAt: -1 });

module.exports = {
  TargetJobProfile: mongoose.model('TargetJobProfile', TargetJobProfileSchema),
  JOB_TYPES,
};
