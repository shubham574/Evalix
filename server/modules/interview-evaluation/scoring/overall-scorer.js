const env = require('../../../config/env');

const calculateOverallScore = ({
  competencyEvaluations = [],
  coverageSummary = {},
  questionEvaluations = [],
  practiceMode = 'REALISTIC_MOCK',
}) => {
  const weights = competencyEvaluations.map((c) => c.weight);
  const allWeightsValid =
    competencyEvaluations.length > 0 &&
    weights.every((w) => typeof w === 'number' && Number.isFinite(w) && w > 0);

  const weightSum = allWeightsValid ? weights.reduce((a, b) => a + b, 0) : 0;
  // Support either 0..1 normalized weights (sum ~ 1.0) or 0..100 percentage weights (sum ~ 100)
  const weightsSumValid =
    allWeightsValid &&
    (Math.abs(weightSum - 1) <= 0.02 || Math.abs(weightSum - 100) <= 1.0);

  const assessedComps = competencyEvaluations.filter(
    (c) => typeof c.score === 'number' && Number.isFinite(c.score)
  );
  const notAssessedComps = competencyEvaluations.filter(
    (c) => c.score === null || c.score === undefined
  );

  const plannedWeight = weightsSumValid ? Math.round(weightSum * 100) / 100 : null;
  const evaluatedWeight = weightsSumValid
    ? Math.round(assessedComps.reduce((a, c) => a + c.weight, 0) * 100) / 100
    : null;
  const notAssessedWeight = weightsSumValid
    ? Math.round(notAssessedComps.reduce((a, c) => a + c.weight, 0) * 100) / 100
    : null;

  const hasCriticalValidationFailure = questionEvaluations.some(
    (q) => q.reviewFlags?.includes('RUBRIC_MISMATCH')
  );
  const coveragePercent = Number(coverageSummary.assessmentCoverage || 0);
  const minCoverage = env.INTERVIEW_EVALUATION_MIN_COVERAGE_PERCENT;

  if (!weightsSumValid || assessedComps.length === 0) {
    return {
      overallScore: null,
      percentageScore: null,
      scoreScale: 5,
      overallStatus: 'INVALID_OR_MISSING_WEIGHTS',
      plannedWeight,
      evaluatedWeight,
      notAssessedWeight,
      normalizationFormula: 'scoreOutOf5 * 20',
      advisoryOnly: true,
    };
  }

  if (coveragePercent < minCoverage || hasCriticalValidationFailure) {
    return {
      overallScore: null,
      percentageScore: null,
      scoreScale: 5,
      overallStatus: hasCriticalValidationFailure
        ? 'NEEDS_REVIEW'
        : 'INSUFFICIENT_COVERAGE',
      plannedWeight,
      evaluatedWeight,
      notAssessedWeight,
      normalizationFormula: 'scoreOutOf5 * 20',
      advisoryOnly: true,
    };
  }

  // Focused skill practice evaluates only a single competency; do not emit a misleading full-interview overall score.
  if (practiceMode === 'FOCUSED_SKILL_PRACTICE') {
    return {
      overallScore: null,
      percentageScore: null,
      scoreScale: 5,
      overallStatus: 'FOCUSED_PRACTICE_SCOPED',
      plannedWeight,
      evaluatedWeight,
      notAssessedWeight,
      normalizationFormula: 'scoreOutOf5 * 20',
      advisoryOnly: true,
    };
  }

  const weightedScoreSum = assessedComps.reduce(
    (acc, c) => acc + c.score * c.weight,
    0
  );
  const assessedWeightSum = assessedComps.reduce((acc, c) => acc + c.weight, 0);
  const overallScore = Math.round((weightedScoreSum / assessedWeightSum) * 100) / 100;
  const percentageScore = Math.round(overallScore * 20 * 10) / 10;

  return {
    overallScore,
    percentageScore,
    scoreScale: 5,
    overallStatus:
      notAssessedComps.length > 0 ? 'PROVISIONAL' : 'VALID',
    plannedWeight,
    evaluatedWeight,
    notAssessedWeight,
    normalizationFormula: 'scoreOutOf5 * 20',
    advisoryOnly: true,
  };
};

module.exports = {
  calculateOverallScore,
};
