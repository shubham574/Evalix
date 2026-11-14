const mongoose = require('mongoose');

const EXPERIENCE_LEVELS = ['INTERN', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'PRINCIPAL'];

const CandidateProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null,
    },
    currentJobTitle: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    totalExperienceMonths: {
      type: Number,
      required: true,
      min: 0,
      max: 720,
      default: 0,
    },
    experienceLevel: {
      type: String,
      required: true,
      enum: EXPERIENCE_LEVELS,
      default: 'JUNIOR',
    },
    professionalSummary: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
    collection: 'candidate_profiles',
  }
);

CandidateProfileSchema.index({ email: 1 });

module.exports = {
  CandidateProfile: mongoose.model('CandidateProfile', CandidateProfileSchema),
  EXPERIENCE_LEVELS,
};
