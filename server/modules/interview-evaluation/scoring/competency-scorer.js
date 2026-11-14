const aggregateCompetencies = ({ internalBlueprint, questionEvaluations = [], questionAssemblies = [] }) => {
  const competencies = Array.isArray(internalBlueprint?.competencies)
    ? internalBlueprint.competencies
    : [];

  const weightByQuestionId = new Map(
    questionAssemblies.map((q) => [q.questionId, q.weight])
  );

  return competencies.map((comp) => {
    const compId = comp.competencyId;
    const compName = comp.name || comp.title || compId;
    const compWeight = Number.isFinite(Number(comp.weight)) ? Number(comp.weight) : null;

    const plannedForComp = questionAssemblies.filter((q) => q.competencyId === compId);
    const evalsForComp = questionEvaluations.filter((e) => e.competencyId === compId);
    const scoredEvals = evalsForComp.filter(
      (e) =>
        typeof e.rating === 'number' &&
        (e.evaluationStatus === 'EVALUATED' || e.evaluationStatus === 'PARTIALLY_EVALUATED')
    );

    const hasReviewRequired = evalsForComp.some((e) => e.reviewRequired);

    let score = null;
    let aggregationMethod = 'EQUAL_WEIGHT';
    if (scoredEvals.length > 0) {
      const allHaveWeights = scoredEvals.every((e) => {
        const w = weightByQuestionId.get(e.questionId);
        return typeof w === 'number' && w > 0;
      });

      if (allHaveWeights) {
        aggregationMethod = 'WEIGHTED_AVERAGE';
        let weightedSum = 0;
        let totalW = 0;
        for (const e of scoredEvals) {
          const w = weightByQuestionId.get(e.questionId);
          weightedSum += e.rating * w;
          totalW += w;
        }
        score = Math.round((weightedSum / totalW) * 100) / 100;
      } else {
        const sum = scoredEvals.reduce((acc, e) => acc + e.rating, 0);
        score = Math.round((sum / scoredEvals.length) * 100) / 100;
      }
    }

    let assessmentStatus = 'NOT_ASSESSED';
    if (scoredEvals.length === 0) {
      assessmentStatus = evalsForComp.some((e) => e.evaluationStatus === 'INSUFFICIENT_EVIDENCE')
        ? 'INSUFFICIENT_EVIDENCE'
        : 'NOT_ASSESSED';
    } else if (hasReviewRequired) {
      assessmentStatus = 'REVIEW_REQUIRED';
    } else if (scoredEvals.length < plannedForComp.length) {
      assessmentStatus = 'PARTIALLY_ASSESSED';
    } else {
      assessmentStatus = 'ASSESSED';
    }

    const evidenceReferences = scoredEvals.flatMap((e) => e.evidenceReferences || []);
    const strengths = Array.from(new Set(scoredEvals.flatMap((e) => e.strengths || [])));
    const developmentAreas = Array.from(
      new Set(evalsForComp.flatMap((e) => e.developmentAreas || []))
    );

    const evidenceSupport =
      scoredEvals.length === 0
        ? 'INSUFFICIENT'
        : scoredEvals.every((e) => e.evidenceSupport === 'HIGH')
        ? 'HIGH'
        : scoredEvals.some((e) => e.evidenceSupport === 'LOW' || e.evidenceSupport === 'INSUFFICIENT')
        ? 'LOW'
        : 'MEDIUM';

    return {
      competencyId: compId,
      competencyName: compName,
      weight: compWeight,
      assessmentStatus,
      score,
      scoreScale: 5,
      aggregationMethod,
      evidenceSupport,
      questionScores: scoredEvals.map((e) => ({
        questionId: e.questionId,
        score: e.rating,
        ratingLabel: e.ratingLabel,
      })),
      coverage: {
        plannedQuestions: plannedForComp.length,
        evaluatedQuestions: scoredEvals.length,
      },
      strengths,
      developmentAreas,
      evidenceReferences,
    };
  });
};

module.exports = {
  aggregateCompetencies,
};
