const mongoose = require('mongoose');
const { ASSESSMENT_STATUSES } = require('./analysis.schema');

const REQUIREMENT_CATEGORIES = [
  'TECHNICAL',
  'FUNCTIONAL',
  'BEHAVIOURAL',
  'EXPERIENCE',
  'EDUCATION',
  'DOMAIN',
  'RESPONSIBILITY',
];

const REQUIREMENT_TYPES = ['MUST_HAVE', 'PREFERRED', 'OPTIONAL'];

const CandidateRequirementAssessmentSchema = new mongoose.Schema(
  {
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateJobAnalysis',
      required: true,
      index: true,
    },
    intakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewIntake',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    requirementId: {
      type: String,
      required: true,
    },
    requirementName: {
      type: String,
      required: true,
    },
    requirementCategory: {
      type: String,
      required: true,
      enum: REQUIREMENT_CATEGORIES,
    },
    requirementType: {
      type: String,
      required: true,
      enum: REQUIREMENT_TYPES,
    },
    matchType: {
      type: String,
      default: 'NO_MATCH',
    },
    assessment: {
      type: String,
      required: true,
      enum: ASSESSMENT_STATUSES,
    },
    candidateFactReferences: {
      type: [String],
      default: [],
    },
    evidenceReferences: {
      type: [String],
      default: [],
    },
    explanation: {
      type: String,
      required: true,
    },
    missingEvidence: {
      type: [String],
      default: [],
    },
    verificationNeeded: {
      type: Boolean,
      default: false,
    },
    assessmentVersion: {
      type: String,
      default: '1.0',
    },
  },
  {
    timestamps: true,
    collection: 'candidate_requirement_assessments',
  }
);

CandidateRequirementAssessmentSchema.index(
  { analysisId: 1, requirementId: 1 },
  { unique: true, name: 'uniq_analysis_requirement_id' }
);
CandidateRequirementAssessmentSchema.index({ analysisId: 1, requirementType: 1, assessment: 1 });

module.exports = {
  CandidateRequirementAssessment: mongoose.model(
    'CandidateRequirementAssessment',
    CandidateRequirementAssessmentSchema
  ),
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_TYPES,
};
