const normalizeForMatch = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const validateEvidenceReferences = ({
  proposedReferences = [],
  candidateTurns = [],
  promptingContext = 'UNPROMPTED',
}) => {
  const turnById = new Map(candidateTurns.map((t) => [String(t.turnId), t]));
  const seen = new Set();
  const verifiedEvidence = [];
  const unverifiedEvidence = [];

  for (const ref of proposedReferences || []) {
    const turnId = String(ref?.turnId || '').trim();
    const quote = String(ref?.quote || '').trim();
    const turn = turnById.get(turnId);

    if (!turn || !quote) {
      unverifiedEvidence.push({
        turnId: turnId || null,
        quote,
        reason: !turn ? 'TURN_NOT_IN_CANDIDATE_QUESTION_TURNS' : 'EMPTY_QUOTE',
      });
      continue;
    }

    const normQuote = normalizeForMatch(quote);
    const normTranscript = normalizeForMatch(turn.spokenText);

    if (!normQuote || !normTranscript.includes(normQuote)) {
      unverifiedEvidence.push({
        turnId,
        quote,
        reason: 'QUOTE_NOT_FOUND_IN_TRANSCRIPT',
      });
      continue;
    }

    const dedupKey = `${turnId}:${normQuote}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    verifiedEvidence.push({
      turnId,
      turnNumber: turn.turnNumber,
      quote,
      timestamp: turn.timestamp || null,
      evidenceType: ref?.evidenceType || promptingContext || 'UNPROMPTED',
    });
  }

  return {
    verifiedEvidence,
    unverifiedEvidence,
  };
};

module.exports = {
  normalizeForMatch,
  validateEvidenceReferences,
};
