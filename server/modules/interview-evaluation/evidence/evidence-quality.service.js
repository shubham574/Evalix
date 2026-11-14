const classifyEvidenceSupport = ({
  verifiedEvidence = [],
  unverifiedEvidence = [],
  criterionEvaluations = [],
  promptingContext = 'UNPROMPTED',
  rubricValid = true,
  hasInvalidTranscript = false,
}) => {
  const reviewFlags = [];

  if (!rubricValid) reviewFlags.push('RUBRIC_MISMATCH');
  if (hasInvalidTranscript) reviewFlags.push('TRANSCRIPT_QUALITY_ISSUE');
  if (
    promptingContext === 'HINT_SUPPORTED' ||
    promptingContext === 'INTERVIEWER_SUPPLIED'
  ) {
    reviewFlags.push('INTERVIEWER_GUIDANCE_DETECTED');
  }
  if (unverifiedEvidence.length > 0) {
    reviewFlags.push('UNVERIFIED_EVIDENCE');
  }

  let evidenceSupport = 'INSUFFICIENT';
  if (verifiedEvidence.length >= 2 && unverifiedEvidence.length === 0 && promptingContext === 'UNPROMPTED') {
    evidenceSupport = 'HIGH';
  } else if (verifiedEvidence.length >= 1 && promptingContext !== 'INTERVIEWER_SUPPLIED') {
    evidenceSupport = unverifiedEvidence.length > 0 ? 'LOW' : 'MEDIUM';
  } else if (verifiedEvidence.length >= 1) {
    evidenceSupport = 'LOW';
  }

  const demonstratedCriteria = (criterionEvaluations || []).filter(
    (c) => c.status === 'DEMONSTRATED'
  ).length;
  if (evidenceSupport === 'HIGH' && demonstratedCriteria === 0 && criterionEvaluations.length > 0) {
    evidenceSupport = 'MEDIUM';
  }

  const reviewRequired =
    !rubricValid ||
    evidenceSupport === 'INSUFFICIENT' ||
    unverifiedEvidence.length > verifiedEvidence.length ||
    promptingContext === 'INTERVIEWER_SUPPLIED';

  return {
    evidenceSupport,
    reviewFlags: Array.from(new Set(reviewFlags)),
    reviewRequired,
  };
};

module.exports = {
  classifyEvidenceSupport,
};
