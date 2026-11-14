/**
 * @deprecated Module 7 Refactor: EVALIX is a student-focused interview practice platform.
 * Active recruiter hiring decision workflows are deprecated and removed from student-facing APIs.
 * Existing collection and historical records are preserved read-only for auditability.
 */
const mongoose = require('mongoose');

const RECRUITER_DECISIONS = [
  'ADVANCE',
  'HOLD_FOR_REVIEW',
  'REQUEST_ADDITIONAL_ASSESSMENT',
  'DO_NOT_ADVANCE',
  'WITHDRAWN',
];

const recruiterDecisionRecordSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    candidateProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateProfile', required: true, index: true },
    intakeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewIntake', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    recruiterId: { type: String, required: true },
    evaluationRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewEvaluationRun', required: true },
    decision: { type: String, enum: RECRUITER_DECISIONS, required: true },
    justification: { type: String, required: true, minlength: 3, maxlength: 2000 },
    additionalAssessmentNotes: { type: String, default: null, maxlength: 1000 },
    changeReason: { type: String, default: null, maxlength: 1000 },
    evidenceReferences: { type: [mongoose.Schema.Types.Mixed], default: [] },
    decisionVersion: { type: Number, required: true, default: 1 },
  },
  {
    timestamps: true,
    collection: 'recruiter_decision_records',
  }
);

recruiterDecisionRecordSchema.index(
  { sessionId: 1, organizationId: 1, decisionVersion: 1 },
  { unique: true }
);

module.exports = {
  RecruiterDecisionRecord: mongoose.model('RecruiterDecisionRecord', recruiterDecisionRecordSchema),
  RECRUITER_DECISIONS,
};
