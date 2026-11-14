const mongoose = require('mongoose');

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'];

const CandidateExperienceSchema = new mongoose.Schema(
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
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    jobTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      default: 'FULL_TIME',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'candidate_experiences',
  }
);

CandidateExperienceSchema.index({ candidateProfileId: 1, startDate: -1 });

module.exports = {
  CandidateExperience: mongoose.model('CandidateExperience', CandidateExperienceSchema),
  EMPLOYMENT_TYPES,
};
