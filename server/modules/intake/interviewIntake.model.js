const mongoose = require('mongoose');

const INTAKE_STATUSES = ['DRAFT', 'READY_FOR_ANALYSIS', 'ANALYSIS_PENDING', 'COMPLETED', 'ARCHIVED'];
const INTERVIEW_TYPES = ['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'MIXED'];
const INTERVIEW_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'ADAPTIVE'];

const InterviewIntakeSchema = new mongoose.Schema(
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
    targetJobProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TargetJobProfile',
      required: true,
    },
    resumeDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateDocument',
      default: null,
    },
    interviewPreferences: {
      interviewType: {
        type: String,
        enum: INTERVIEW_TYPES,
        default: 'MIXED',
      },
      durationMinutes: {
        type: Number,
        min: 15,
        max: 120,
        default: 45,
      },
      difficulty: {
        type: String,
        enum: INTERVIEW_DIFFICULTIES,
        default: 'ADAPTIVE',
      },
      focusAreas: {
        type: [String],
        default: [],
      },
    },
    status: {
      type: String,
      required: true,
      enum: INTAKE_STATUSES,
      default: 'DRAFT',
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    parentIntakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewIntake',
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    analysisEventPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'interview_intakes',
  }
);

InterviewIntakeSchema.index({ userId: 1, status: 1, createdAt: -1 });
InterviewIntakeSchema.index({ candidateProfileId: 1, createdAt: -1 });

module.exports = {
  InterviewIntake: mongoose.model('InterviewIntake', InterviewIntakeSchema),
  INTAKE_STATUSES,
  INTERVIEW_TYPES,
  INTERVIEW_DIFFICULTIES,
};
