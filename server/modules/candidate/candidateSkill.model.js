const mongoose = require('mongoose');

const SKILL_CATEGORIES = [
  'PROGRAMMING_LANGUAGE',
  'FRAMEWORK',
  'DATABASE',
  'CLOUD',
  'DEVOPS',
  'TOOL',
  'SOFT_SKILL',
  'OTHER',
];

const PROFICIENCY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

const CandidateSkillSchema = new mongoose.Schema(
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
    skillName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    normalizedSkillName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
    },
    skillCategory: {
      type: String,
      enum: SKILL_CATEGORIES,
      default: 'OTHER',
    },
    selfReportedProficiency: {
      type: String,
      enum: PROFICIENCY_LEVELS,
      default: 'INTERMEDIATE',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'candidate_skills',
  }
);

CandidateSkillSchema.index({ candidateProfileId: 1, normalizedSkillName: 1 }, { unique: true });

module.exports = {
  CandidateSkill: mongoose.model('CandidateSkill', CandidateSkillSchema),
  SKILL_CATEGORIES,
  PROFICIENCY_LEVELS,
};
