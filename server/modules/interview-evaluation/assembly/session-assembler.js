const mongoose = require('mongoose');
const InterviewSession = require('../../interview-orchestrator/session/interviewSession.model');
const InterviewTurn = require('../../interview-orchestrator/turns/interviewTurn.model');
const { InterviewBlueprint } = require('../../interview-blueprint/models/interviewBlueprint.model');
const { CandidateJobAnalysis } = require('../../candidate-intelligence/analysis/candidateJobAnalysis.model');
const { validateSessionForEvaluation } = require('./transcript-validator');
const { assembleQuestionResponses } = require('./question-response-assembler');

const findSession = async (sessionIdOrUuid) => {
  const query = mongoose.isValidObjectId(sessionIdOrUuid)
    ? { $or: [{ _id: sessionIdOrUuid }, { sessionId: sessionIdOrUuid }] }
    : { sessionId: sessionIdOrUuid };
  return InterviewSession.findOne(query).lean();
};

const assembleSessionForEvaluation = async (sessionIdOrUuid) => {
  const session = await findSession(sessionIdOrUuid);
  if (!session) {
    return validateSessionForEvaluation({ session: null, blueprintDoc: null, turns: [] });
  }

  const [blueprintDoc, turns, analysisDoc] = await Promise.all([
    InterviewBlueprint.findById(session.blueprintId).lean(),
    InterviewTurn.find({ sessionId: session._id }).sort({ turnNumber: 1 }).lean(),
    CandidateJobAnalysis.findById(session.candidateAnalysisId).lean(),
  ]);

  const validated = validateSessionForEvaluation({
    session,
    blueprintDoc,
    turns,
  });

  const questionAssemblies = assembleQuestionResponses({
    session,
    internalBlueprint: validated.internalBlueprint,
    validTurns: validated.validTurns,
    invalidTurns: validated.invalidTurns,
  });

  return {
    session,
    blueprintDoc,
    internalBlueprint: validated.internalBlueprint,
    validTurns: validated.validTurns,
    invalidTurns: validated.invalidTurns,
    questionAssemblies,
    sessionSnapshotChecksum: validated.sessionSnapshotChecksum,
    isPartialSession: validated.isPartialSession,
    candidateContext: analysisDoc
      ? {
          targetRole: session.targetRole,
          seniorityLevel: session.seniorityLevel,
          interviewType: session.interviewType,
        }
      : {
          targetRole: session.targetRole,
          seniorityLevel: session.seniorityLevel,
          interviewType: session.interviewType,
        },
  };
};

module.exports = {
  findSession,
  assembleSessionForEvaluation,
};
