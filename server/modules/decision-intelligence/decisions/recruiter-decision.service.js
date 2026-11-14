/**
 * @deprecated Module 7 Refactor: Recruiter hiring decisions are deprecated.
 * Historical records remain preserved in `recruiter_decision_records` and are not exposed
 * to student-facing APIs.
 */
const AppError = require('../../common/errors/AppError');
const { findSession } = require('../../interview-evaluation/assembly/session-assembler');
const { InterviewEvaluationRun } = require('../../interview-evaluation/models/interviewEvaluationRun.model');
const { RecruiterDecisionRecord } = require('./recruiterDecisionRecord.model');

const createRecruiterDecision = async ({
  sessionIdOrUuid,
  organizationId,
  recruiterId,
  decision,
  justification,
  additionalAssessmentNotes = null,
  changeReason = null,
  evidenceReferences = [],
}) => {
  const session = await findSession(sessionIdOrUuid);
  if (!session) {
    throw new AppError(404, 'Interview session not found', 'SESSION_NOT_FOUND');
  }
  if (session.organizationId && session.organizationId !== organizationId) {
    throw new AppError(403, 'Cross-organization access is forbidden', 'ORGANIZATION_FORBIDDEN');
  }

  const evaluationRun = await InterviewEvaluationRun.findOne({
    sessionId: session._id,
    status: { $ne: 'SUPERSEDED' },
  })
    .sort({ evaluationVersion: -1 })
    .lean();

  if (!evaluationRun) {
    throw new AppError(
      409,
      'Cannot record recruiter decision before an evaluation run exists',
      'EVALUATION_REQUIRED'
    );
  }

  const latest = await RecruiterDecisionRecord.findOne({
    sessionId: session._id,
    organizationId,
  })
    .sort({ decisionVersion: -1 })
    .lean();

  const nextVersion = latest ? latest.decisionVersion + 1 : 1;

  const created = await RecruiterDecisionRecord.create({
    organizationId,
    candidateProfileId: session.candidateProfileId,
    intakeId: session.intakeId,
    sessionId: session._id,
    recruiterId,
    evaluationRunId: evaluationRun._id,
    decision,
    justification,
    additionalAssessmentNotes,
    changeReason: latest ? changeReason || 'Updated recruiter assessment' : null,
    evidenceReferences,
    decisionVersion: nextVersion,
  });

  return created.toObject();
};

const getRecruiterDecisionHistory = async ({ sessionIdOrUuid, organizationId }) => {
  const session = await findSession(sessionIdOrUuid);
  if (!session) {
    throw new AppError(404, 'Interview session not found', 'SESSION_NOT_FOUND');
  }
  if (session.organizationId && session.organizationId !== organizationId) {
    throw new AppError(403, 'Cross-organization access is forbidden', 'ORGANIZATION_FORBIDDEN');
  }

  const records = await RecruiterDecisionRecord.find({
    sessionId: session._id,
    organizationId,
  })
    .sort({ decisionVersion: 1 })
    .lean();

  return { session, decisions: records };
};

module.exports = {
  createRecruiterDecision,
  getRecruiterDecisionHistory,
};
