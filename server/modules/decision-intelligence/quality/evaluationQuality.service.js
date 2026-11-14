const { EvaluationQualityReport } = require('./evaluationQualityReport.model');
const { aggregateCompetencies } = require('../../interview-evaluation/scoring/competency-scorer');
const { calculateCoverage } = require('../../interview-evaluation/scoring/coverage-calculator');

const QUALITY_CHECK_VERSION = 1;

const runEvaluationQualityChecks = async ({
  session,
  blueprintDoc,
  turns = [],
  evaluationRun,
  questionEvaluations = [],
  competencyEvaluations = [],
}) => {
  const qualityFlags = [];

  // A. Source integrity
  const blueprintVersionMatches =
    Boolean(blueprintDoc) &&
    Number(blueprintDoc.blueprintVersion) === Number(session.blueprintVersion) &&
    Number(evaluationRun.blueprintVersion) === Number(session.blueprintVersion);

  if (!blueprintVersionMatches) qualityFlags.push('BLUEPRINT_VERSION_MISMATCH');

  const candidateTurnIds = new Set(
    turns
      .filter((t) => String(t.sessionId) === String(session._id) && t.speaker === 'CANDIDATE')
      .map((t) => String(t._id))
  );

  let invalidEvidenceCount = 0;
  let unverifiedEvidenceCount = 0;
  let missingRubricCount = 0;

  for (const q of questionEvaluations) {
    if (q.reviewFlags?.includes('RUBRIC_MISMATCH')) missingRubricCount += 1;
    unverifiedEvidenceCount += (q.unverifiedEvidenceReferences || []).length;
    for (const ref of q.evidenceReferences || []) {
      if (!candidateTurnIds.has(String(ref.turnId))) {
        invalidEvidenceCount += 1;
      }
    }
  }

  if (invalidEvidenceCount > 0) qualityFlags.push('INVALID_EVIDENCE_TURN_REFERENCE');
  if (unverifiedEvidenceCount > 0) qualityFlags.push('UNVERIFIED_EVIDENCE_PRESENT');
  if (missingRubricCount > 0) qualityFlags.push('MISSING_RUBRIC_DETECTED');

  // B. Coverage checks
  const recomputedCoverage = calculateCoverage({ questionEvaluations });
  const coverageMatches =
    recomputedCoverage.evaluatedQuestions === (evaluationRun.coverageSummary?.evaluatedQuestions ?? recomputedCoverage.evaluatedQuestions);
  if (recomputedCoverage.assessmentCoverage < 50) {
    qualityFlags.push('LOW_ASSESSMENT_COVERAGE');
  }

  // C. Scoring consistency checks
  const notAssessedHasNonNullScore = competencyEvaluations.some(
    (c) => c.assessmentStatus === 'NOT_ASSESSED' && c.score !== null
  );
  if (notAssessedHasNonNullScore) {
    qualityFlags.push('NOT_ASSESSED_COMPETENCY_NON_NULL_SCORE');
  }

  const questionAssemblies = (blueprintDoc?.questionPlan || []).map((q) => ({
    questionId: q.questionId,
    competencyId: q.competencyId || q.competencyIds?.[0] || null,
    weight: Number.isFinite(Number(q.weight)) ? Number(q.weight) : null,
  }));
  const recomputedComps = aggregateCompetencies({
    internalBlueprint: { competencies: blueprintDoc?.competencyPlan || [] },
    questionEvaluations,
    questionAssemblies,
  });

  let scoringMismatchCount = 0;
  for (const stored of competencyEvaluations) {
    const expected = recomputedComps.find((c) => c.competencyId === stored.competencyId);
    if (expected && expected.score !== stored.score) {
      scoringMismatchCount += 1;
    }
  }
  if (scoringMismatchCount > 0) {
    qualityFlags.push('COMPETENCY_SCORING_INCONSISTENCY');
  }

  // D. Interviewer & session quality
  const interruptedQuestions = questionEvaluations.filter(
    (q) => q.evaluationStatus === 'INTERRUPTED'
  ).length;
  const interviewerGuidedQuestions = questionEvaluations.filter(
    (q) => q.promptingContext === 'INTERVIEWER_SUPPLIED'
  ).length;
  if (interruptedQuestions > 0) qualityFlags.push('INTERRUPTED_ASSESSMENTS');
  if (interviewerGuidedQuestions > 0) qualityFlags.push('INTERVIEWER_SUPPLIED_ANSWERS');

  const hasCriticalFailure =
    !blueprintVersionMatches ||
    invalidEvidenceCount > 0 ||
    notAssessedHasNonNullScore ||
    scoringMismatchCount > 0;

  const qualityStatus = hasCriticalFailure
    ? 'FAILED'
    : qualityFlags.length > 0
    ? 'PASSED_WITH_WARNINGS'
    : 'PASSED';

  const latest = await EvaluationQualityReport.findOne({
    evaluationRunId: evaluationRun._id,
  })
    .sort({ qualityCheckVersion: -1 })
    .lean();

  const nextVersion = latest ? latest.qualityCheckVersion + 1 : 1;
  const saved = await EvaluationQualityReport.create({
    evaluationRunId: evaluationRun._id,
    sessionId: session._id,
    qualityCheckVersion: nextVersion,
    integrityChecks: {
      blueprintVersionMatches,
      missingRubricCount,
      invalidEvidenceCount,
    },
    coverageChecks: {
      ...recomputedCoverage,
      coverageMatches,
    },
    scoringChecks: {
      notAssessedHasNonNullScore,
      scoringMismatchCount,
    },
    evidenceChecks: {
      unverifiedEvidenceCount,
      invalidEvidenceCount,
    },
    interviewerChecks: {
      interruptedQuestions,
      interviewerGuidedQuestions,
    },
    qualityFlags: Array.from(new Set(qualityFlags)),
    qualityStatus,
  });

  return saved.toObject();
};

const buildStudentQualityNotice = (qualityReport) => {
  if (!qualityReport) return [];
  const flags = new Set(qualityReport.qualityFlags || []);
  const notices = [];

  if (flags.has('INTERRUPTED_ASSESSMENTS')) {
    notices.push({
      severity: 'INFO',
      code: 'INTERRUPTED_SESSION',
      message:
        'Some questions in this practice session were interrupted before completion. Consider retrying those topics in a focused practice session.',
    });
  }
  if (flags.has('LOW_ASSESSMENT_COVERAGE')) {
    notices.push({
      severity: 'INFO',
      code: 'INCOMPLETE_COVERAGE',
      message:
        'Only part of the planned interview topics were covered in this session, so your overall practice score may not reflect your full preparation.',
    });
  }
  if (flags.has('UNVERIFIED_EVIDENCE_PRESENT') || flags.has('INVALID_EVIDENCE_TURN_REFERENCE')) {
    notices.push({
      severity: 'WARNING',
      code: 'TRANSCRIPT_RELIABILITY',
      message:
        'This interview contained incomplete or unclear audio transcription for one or more responses. Your feedback may not fully reflect your spoken answers.',
    });
  }
  if (flags.has('COMPETENCY_SCORING_INCONSISTENCY') || flags.has('BLUEPRINT_VERSION_MISMATCH')) {
    notices.push({
      severity: 'WARNING',
      code: 'EVALUATION_UNDER_VERIFICATION',
      message:
        'Some evaluation details in this session require verification and may not be fully reliable. Consider repeating the practice session.',
    });
  }
  return notices;
};

module.exports = {
  runEvaluationQualityChecks,
  buildStudentQualityNotice,
  QUALITY_CHECK_VERSION,
};
