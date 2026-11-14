const env = require('../../../config/env');
const { StudentPracticeReport } = require('../reports/studentPracticeReport.model');

const METHODOLOGY_VERSION = '2.0';
const SCALE_MAX = 5;

const toPercent = (score, scale = SCALE_MAX) =>
  typeof score === 'number' && scale > 0
    ? Math.round((score / scale) * 1000) / 10
    : null;

const getNonComparableReasons = (a, b) => {
  const reasons = [];
  if (!a || !b) {
    reasons.push('Missing one or both practice reports');
    return reasons;
  }

  const roleA = String(a.targetRole || '').trim().toLowerCase();
  const roleB = String(b.targetRole || '').trim().toLowerCase();
  if (roleA !== roleB) {
    reasons.push(`Different target roles ('${a.targetRole}' vs '${b.targetRole}')`);
  }

  const modeA = a.practiceMode || a.sourceVersions?.practiceMode || 'REALISTIC_MOCK';
  const modeB = b.practiceMode || b.sourceVersions?.practiceMode || 'REALISTIC_MOCK';
  if (modeA !== modeB) {
    reasons.push(`Different practice modes ('${modeA}' vs '${modeB}')`);
  }

  if (modeA === 'FOCUSED_SKILL_PRACTICE' && modeB === 'FOCUSED_SKILL_PRACTICE') {
    const compA = a.focusedCompetencyId || null;
    const compB = b.focusedCompetencyId || null;
    if (compA !== compB) {
      reasons.push(`Different focused competencies ('${compA}' vs '${compB}')`);
    }
  }

  const evA = String(a.sourceVersions?.evaluatorVersion || '6.0.0').split('.')[0];
  const evB = String(b.sourceVersions?.evaluatorVersion || '6.0.0').split('.')[0];
  if (evA !== evB) {
    reasons.push(`Incompatible evaluator major versions ('v${evA}' vs 'v${evB}')`);
  }

  const diffA = a.sourceVersions?.difficulty || 'MID';
  const diffB = b.sourceVersions?.difficulty || 'MID';
  if (diffA !== diffB) {
    reasons.push(`Different assessment difficulty ('${diffA}' vs '${diffB}')`);
  }

  const scaleA = Number(a.sourceVersions?.scoreScale || 5);
  const scaleB = Number(b.sourceVersions?.scoreScale || 5);
  if (scaleA !== scaleB) {
    reasons.push(`Incompatible scoring scales (${scaleA} vs ${scaleB})`);
  }

  const aggA = a.sourceVersions?.aggregationMethod || 'EQUAL_WEIGHT';
  const aggB = b.sourceVersions?.aggregationMethod || 'EQUAL_WEIGHT';
  if (aggA !== aggB) {
    reasons.push(`Incompatible scoring methodologies ('${aggA}' vs '${aggB}')`);
  }

  const minCov = env.INTERVIEW_EVALUATION_MIN_COVERAGE_PERCENT;
  if (Number(a.assessmentCoverage || 0) < minCov || Number(b.assessmentCoverage || 0) < minCov) {
    reasons.push(`Insufficient assessment coverage (minimum ${minCov}% required)`);
  }

  if (
    modeA !== 'FOCUSED_SKILL_PRACTICE' &&
    (typeof a.overallPracticeScore !== 'number' || typeof b.overallPracticeScore !== 'number')
  ) {
    reasons.push('Missing valid overall evaluation score in one or more attempts');
  }

  return reasons;
};

const isComparableReport = (a, b) => getNonComparableReasons(a, b).length === 0;

/**
 * Compares two practice reports across all 10 longitudinal compatibility dimensions.
 */
const comparePracticeReports = (reportA, reportB) => {
  const nonComparableReasons = getNonComparableReasons(reportA, reportB);
  const comparedAttempts = [
    reportA?.sessionUuid || String(reportA?._id || ''),
    reportB?.sessionUuid || String(reportB?._id || ''),
  ];

  if (nonComparableReasons.length > 0) {
    return {
      comparisonStatus: 'NON_COMPARABLE',
      comparisonMethod: 'INCOMPATIBLE_ASSESSMENT',
      comparedAttempts,
      comparableCompetencies: [],
      excludedCompetencies: [],
      nonComparableReasons,
      methodologyVersion: METHODOLOGY_VERSION,
    };
  }

  const compsA = new Map((reportA.competencyInsights || []).map((c) => [c.competencyId, c]));
  const compsB = new Map((reportB.competencyInsights || []).map((c) => [c.competencyId, c]));
  const allIds = new Set([...compsA.keys(), ...compsB.keys()]);

  const comparableCompetencies = [];
  const excludedCompetencies = [];

  for (const compId of allIds) {
    const cA = compsA.get(compId);
    const cB = compsB.get(compId);
    if (!cA || !cB) {
      excludedCompetencies.push({
        competencyId: compId,
        reason: 'Competency not present in both sessions',
      });
      continue;
    }

    const unassessed = new Set(['NOT_ASSESSED', 'INSUFFICIENT_EVIDENCE', 'REVIEW_REQUIRED']);
    if (
      unassessed.has(cA.assessmentStatus) ||
      unassessed.has(cB.assessmentStatus) ||
      typeof cA.effectiveScore !== 'number' ||
      typeof cB.effectiveScore !== 'number'
    ) {
      excludedCompetencies.push({
        competencyId: compId,
        reason: 'Insufficient or unassessed competency evidence',
      });
      continue;
    }

    const rA = cA.rubricVersion || reportA.sourceVersions?.rubricVersion || '1.0';
    const rB = cB.rubricVersion || reportB.sourceVersions?.rubricVersion || '1.0';
    if (rA !== rB) {
      excludedCompetencies.push({
        competencyId: compId,
        reason: `Incompatible rubric version ('${rA}' vs '${rB}')`,
      });
      continue;
    }

    const sA = Number(cA.scoreScale || reportA.sourceVersions?.scoreScale || 5);
    const sB = Number(cB.scoreScale || reportB.sourceVersions?.scoreScale || 5);
    if (sA !== sB) {
      excludedCompetencies.push({
        competencyId: compId,
        reason: `Incompatible scoring scale (${sA} vs ${sB})`,
      });
      continue;
    }

    const mA = cA.aggregationMethod || reportA.sourceVersions?.aggregationMethod || 'EQUAL_WEIGHT';
    const mB = cB.aggregationMethod || reportB.sourceVersions?.aggregationMethod || 'EQUAL_WEIGHT';
    if (mA !== mB) {
      excludedCompetencies.push({
        competencyId: compId,
        reason: `Incompatible scoring methodology ('${mA}' vs '${mB}')`,
      });
      continue;
    }

    comparableCompetencies.push(compId);
  }

  if (comparableCompetencies.length === 0) {
    return {
      comparisonStatus: 'NON_COMPARABLE',
      comparisonMethod: 'NO_OVERLAPPING_COMPATIBLE_COMPETENCIES',
      comparedAttempts,
      comparableCompetencies: [],
      excludedCompetencies,
      nonComparableReasons: ['No overlapping competencies with compatible rubric and scoring definitions'],
      methodologyVersion: METHODOLOGY_VERSION,
    };
  }

  return {
    comparisonStatus: 'COMPARABLE',
    comparisonMethod: 'SAME_COMPETENCY_RUBRIC',
    comparedAttempts,
    comparableCompetencies,
    excludedCompetencies,
    nonComparableReasons: [],
    methodologyVersion: METHODOLOGY_VERSION,
  };
};

const getCandidatePracticeHistory = async ({ userId }) => {
  const reports = await StudentPracticeReport.find({
    userId,
    generationStatus: 'GENERATED',
  })
    .sort({ createdAt: 1 })
    .lean();

  const attempts = reports.map((r, idx) => ({
    attemptNumber: idx + 1,
    sessionId: r.sessionUuid,
    reportId: String(r._id),
    reportVersion: r.reportVersion,
    targetRole: r.targetRole,
    practiceMode: r.practiceMode || 'REALISTIC_MOCK',
    overallPracticeScore: r.overallPracticeScore,
    overallPracticePercent: toPercent(r.overallPracticeScore, r.sourceVersions?.scoreScale || 5),
    assessmentCoverage: r.assessmentCoverage,
    reportStatus: r.reportStatus,
    sourceVersions: r.sourceVersions,
    practicedAt: r.practiceSummary?.interviewDate || r.createdAt,
  }));

  return {
    totalAttempts: attempts.length,
    attempts,
  };
};

const getCandidateCompetencyProgress = async ({ userId }) => {
  const reports = await StudentPracticeReport.find({
    userId,
    generationStatus: 'GENERATED',
  })
    .sort({ createdAt: 1 })
    .lean();

  const minCov = env.INTERVIEW_EVALUATION_MIN_COVERAGE_PERCENT;
  const seriesByGroup = new Map();

  for (const report of reports) {
    if (Number(report.assessmentCoverage || 0) < minCov) continue;

    const majorEval = String(report.sourceVersions?.evaluatorVersion || '6.0.0').split('.')[0];
    const mode = report.practiceMode || 'REALISTIC_MOCK';
    const roleKey = String(report.targetRole || 'GENERAL').trim().toLowerCase();
    const difficulty = report.sourceVersions?.difficulty || 'MID';

    for (const comp of report.competencyInsights || []) {
      if (
        comp.assessmentStatus === 'NOT_ASSESSED' ||
        comp.assessmentStatus === 'INSUFFICIENT_EVIDENCE' ||
        comp.assessmentStatus === 'REVIEW_REQUIRED' ||
        typeof comp.effectiveScore !== 'number'
      ) {
        continue;
      }

      const rubricVer = comp.rubricVersion || report.sourceVersions?.rubricVersion || '1.0';
      const scale = Number(comp.scoreScale || report.sourceVersions?.scoreScale || 5);
      const agg = comp.aggregationMethod || report.sourceVersions?.aggregationMethod || 'EQUAL_WEIGHT';

      const groupKey = `${roleKey}::${mode}::v${majorEval}::${difficulty}::${rubricVer}::${scale}::${agg}::${comp.competencyId}`;
      if (!seriesByGroup.has(groupKey)) {
        seriesByGroup.set(groupKey, {
          competencyId: comp.competencyId,
          competencyName: comp.competencyName,
          targetRole: report.targetRole,
          practiceMode: mode,
          difficulty,
          rubricVersion: rubricVer,
          evaluatorMajorVersion: `v${majorEval}`,
          scoreScale: scale,
          aggregationMethod: agg,
          attempts: [],
        });
      }

      seriesByGroup.get(groupKey).attempts.push({
        sessionId: report.sessionUuid,
        practicedAt: report.practiceSummary?.interviewDate || report.createdAt,
        rawScore: comp.effectiveScore,
        normalizedPercent: toPercent(comp.effectiveScore, scale),
        assessmentCoverage: report.assessmentCoverage,
        sourceVersions: report.sourceVersions,
      });
    }
  }

  const competencyTrends = [];
  for (const group of seriesByGroup.values()) {
    const count = group.attempts.length;
    const first = group.attempts[0];
    const latest = group.attempts[count - 1];
    const deltaPercent =
      count >= 2
        ? Math.round((latest.normalizedPercent - first.normalizedPercent) * 10) / 10
        : null;

    let trend = 'BASELINE_ONLY';
    if (count >= 2) {
      if (deltaPercent >= 5) trend = 'IMPROVING';
      else if (deltaPercent <= -5) trend = 'NEEDS_REFRESH';
      else trend = 'STABLE';
    }

    competencyTrends.push({
      ...group,
      comparableAttemptCount: count,
      deltaPercent,
      trend,
      masteryClaimed: false,
      methodologyVersion: METHODOLOGY_VERSION,
      methodologyNote:
        'Only sessions with matching target role, practice mode, difficulty, rubric version, scoring scale, methodology, and sufficient coverage are compared.',
    });
  }

  const pairwiseComparisons = [];
  for (let i = 1; i < reports.length; i += 1) {
    pairwiseComparisons.push(comparePracticeReports(reports[i - 1], reports[i]));
  }

  return {
    methodologyVersion: METHODOLOGY_VERSION,
    comparisonMethodology:
      'Scores are compared strictly within matching targetRole, practiceMode, difficulty, major evaluatorVersion, rubricVersion, scoreScale, aggregationMethod, and minimum assessment coverage.',
    competencyTrends,
    pairwiseComparisons,
  };
};

module.exports = {
  getCandidatePracticeHistory,
  getCandidateCompetencyProgress,
  comparePracticeReports,
  isComparableReport,
  getNonComparableReasons,
  METHODOLOGY_VERSION,
};
