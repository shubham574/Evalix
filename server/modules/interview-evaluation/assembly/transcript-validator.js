const crypto = require('crypto');
const AppError = require('../../common/errors/AppError');
const {
  computeBlueprintChecksum,
} = require('../../interview-orchestrator/runtime/interview-runtime.service');
const {
  toInternalOrchestratorBlueprint,
} = require('../../interview-blueprint/serializers/blueprint.serializer');

const SUPPORTED_TERMINAL_STATUSES = new Set(['COMPLETED', 'ABANDONED']);

const validateSessionForEvaluation = ({ session, blueprintDoc, turns = [] }) => {
  if (!session) {
    throw new AppError(404, 'Interview session not found', 'SESSION_NOT_FOUND');
  }
  if (!SUPPORTED_TERMINAL_STATUSES.has(session.status)) {
    throw new AppError(
      409,
      `Session status '${session.status}' is not eligible for evaluation; expected COMPLETED or ABANDONED`,
      'SESSION_NOT_TERMINAL'
    );
  }
  if (!blueprintDoc) {
    throw new AppError(404, 'Associated interview blueprint not found', 'BLUEPRINT_NOT_FOUND');
  }
  if (Number(blueprintDoc.blueprintVersion) !== Number(session.blueprintVersion)) {
    throw new AppError(
      409,
      `Blueprint version mismatch: session locked v${session.blueprintVersion}, found v${blueprintDoc.blueprintVersion}`,
      'BLUEPRINT_VERSION_MISMATCH'
    );
  }

  const internalBlueprint = toInternalOrchestratorBlueprint(blueprintDoc);
  const computedChecksum = computeBlueprintChecksum(internalBlueprint);
  if (
    session.blueprintChecksum &&
    session.blueprintChecksum !== computedChecksum
  ) {
    throw new AppError(
      409,
      'Blueprint checksum verification failed; historical blueprint integrity mismatch',
      'BLUEPRINT_CHECKSUM_MISMATCH'
    );
  }

  // Deduplicate turns by immutable _id and turnNumber, verifying ownership to session
  const seenIds = new Set();
  const seenTurnNumbers = new Set();
  const validTurns = [];
  const invalidTurns = [];

  for (const t of turns) {
    if (String(t.sessionId) !== String(session._id)) {
      throw new AppError(
        409,
        'Turn ownership mismatch detected during assembly',
        'TURN_SESSION_MISMATCH'
      );
    }
    const idKey = String(t._id);
    if (seenIds.has(idKey) || seenTurnNumbers.has(t.turnNumber)) {
      continue;
    }
    seenIds.add(idKey);
    seenTurnNumbers.add(t.turnNumber);

    if (t.speaker === 'CANDIDATE') {
      if (t.transcriptStatus === 'PARTIAL' || t.processingStatus === 'IGNORED') {
        continue;
      }
      if (t.transcriptStatus === 'EMPTY' || !String(t.spokenText || t.rawTranscript || '').trim()) {
        invalidTurns.push(t);
        continue;
      }
    }
    validTurns.push(t);
  }

  validTurns.sort((a, b) => a.turnNumber - b.turnNumber);

  const sessionSnapshotChecksum = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        sessionId: session.sessionId,
        blueprintId: String(session.blueprintId),
        blueprintVersion: session.blueprintVersion,
        turnIds: validTurns.map((t) => `${t._id}:${t.turnNumber}:${t.spokenText}`),
      })
    )
    .digest('hex');

  return {
    internalBlueprint,
    validTurns,
    invalidTurns,
    sessionSnapshotChecksum,
    isPartialSession: session.status === 'ABANDONED',
  };
};

module.exports = {
  SUPPORTED_TERMINAL_STATUSES,
  validateSessionForEvaluation,
};
