const calculateCoverage = ({ questionEvaluations = [] }) => {
  const plannedQuestions = questionEvaluations.length;
  const excludedQuestions = questionEvaluations.filter(
    (q) => q.evaluationStatus === 'EXCLUDED_BY_SESSION_POLICY'
  ).length;
  const notAskedQuestions = questionEvaluations.filter(
    (q) => q.evaluationStatus === 'NOT_ASKED'
  ).length;
  const notAnsweredQuestions = questionEvaluations.filter(
    (q) => q.evaluationStatus === 'NOT_ANSWERED'
  ).length;
  const interruptedQuestions = questionEvaluations.filter(
    (q) => q.evaluationStatus === 'INTERRUPTED'
  ).length;
  const invalidTranscriptQuestions = questionEvaluations.filter(
    (q) => q.evaluationStatus === 'INVALID_TRANSCRIPT'
  ).length;
  const evaluatedQuestions = questionEvaluations.filter(
    (q) =>
      q.evaluationStatus === 'EVALUATED' ||
      q.evaluationStatus === 'PARTIALLY_EVALUATED'
  ).length;

  const askedQuestions = plannedQuestions - notAskedQuestions - excludedQuestions;
  const assessablePlanned = Math.max(0, plannedQuestions - excludedQuestions);
  const assessmentCoverage =
    assessablePlanned > 0
      ? Math.round((evaluatedQuestions / assessablePlanned) * 1000) / 10
      : 0;

  return {
    plannedQuestions,
    askedQuestions: Math.max(0, askedQuestions),
    evaluatedQuestions,
    notAssessedQuestions: notAskedQuestions + notAnsweredQuestions + interruptedQuestions,
    invalidTranscriptQuestions,
    excludedQuestions,
    assessmentCoverage,
  };
};

module.exports = {
  calculateCoverage,
};
