const { z } = require('zod');
const env = require('../../../config/env');
const { mapPreparationCoverage } = require('../recruiter/requirement-summary.service');
const { buildAnswerImprovementGuidance } = require('./answer-improvement.service');
const { buildStudentQualityNotice } = require('../quality/evaluationQuality.service');

const STUDENT_FEEDBACK_PROMPT_VERSION = 'module7.student_feedback.v1';

const coachingSummarySchema = z.object({
  coachingSummary: z.string().min(10).max(1200),
});

const classifyStudentReportStatus = ({
  evaluationRun,
  qualityReport,
  preparationCoverage = [],
  coverageSummary = {},
}) => {
  if (
    qualityReport?.qualityStatus === 'FAILED' ||
    evaluationRun.status === 'NEEDS_REVIEW' ||
    preparationCoverage.some((r) => r.practiceStatus === 'REVIEW_REQUIRED')
  ) {
    return 'REVIEW_REQUIRED';
  }

  const minCoverage = env.INTERVIEW_EVALUATION_MIN_COVERAGE_PERCENT;
  if (
    evaluationRun.status === 'INSUFFICIENT_COVERAGE' ||
    Number(coverageSummary.assessmentCoverage || 0) < minCoverage
  ) {
    return 'INSUFFICIENT_ASSESSMENT_COVERAGE';
  }

  const mustHaves = preparationCoverage.filter((r) => r.requirementType === 'MUST_HAVE');
  const pool = mustHaves.length > 0 ? mustHaves : preparationCoverage;
  const demonstratedCount = pool.filter(
    (r) => r.practiceStatus === 'DEMONSTRATED_IN_PRACTICE'
  ).length;
  const needsPracticeCount = pool.filter(
    (r) =>
      r.practiceStatus === 'PARTIALLY_DEMONSTRATED' ||
      r.practiceStatus === 'NEEDS_MORE_PRACTICE'
  ).length;

  if (pool.length > 0 && demonstratedCount === pool.length) {
    return 'STRONG_PREPARATION_EVIDENCE';
  }
  if (demonstratedCount > 0 && needsPracticeCount > 0) {
    return 'MIXED_PRACTICE_EVIDENCE';
  }
  if (demonstratedCount > 0) {
    return 'STRONG_PREPARATION_EVIDENCE';
  }
  return 'NEEDS_TARGETED_PRACTICE';
};

const detectPerformancePatterns = ({ questionEvaluations = [], turns = [] }) => {
  const patterns = [];
  const evaluated = questionEvaluations.filter((q) => q.evaluationStatus !== 'NOT_ASKED');
  if (evaluated.length < 2) return patterns;

  const candidateTurns = turns.filter((t) => t.speaker === 'CANDIDATE');
  const shortTurns = candidateTurns.filter(
    (t) => String(t.spokenText || t.rawTranscript || '').trim().split(/\s+/).length < 18
  );
  if (shortTurns.length >= 2) {
    patterns.push({
      patternCode: 'BRIEF_RESPONSES',
      observation:
        'Several responses were quite brief. Expanding with concrete examples and reasoning can better showcase your knowledge.',
      supportingQuestionIds: shortTurns.map((t) => t.questionId).filter(Boolean),
    });
  }

  const missingTradeoffs = evaluated.filter((q) =>
    (q.missingEvidence || []).some((m) => /trade-?off|edge case|scale|invalidat/i.test(m))
  );
  if (missingTradeoffs.length >= 2) {
    patterns.push({
      patternCode: 'MISSING_TRADEOFFS',
      observation:
        'Multiple technical answers covered the core concept but missed explaining design trade-offs or edge cases.',
      supportingQuestionIds: missingTradeoffs.map((q) => q.questionId),
    });
  }

  const incompleteBehavioral = evaluated.filter(
    (q) =>
      String(q.questionType || '').toUpperCase().includes('BEHAVIOUR') &&
      typeof q.rating === 'number' &&
      q.rating <= 3
  );
  if (incompleteBehavioral.length >= 2) {
    patterns.push({
      patternCode: 'INCOMPLETE_BEHAVIOURAL_STRUCTURE',
      observation:
        'Behavioural answers would be stronger with clearer Situation, Task, Action, and measurable Result framing.',
      supportingQuestionIds: incompleteBehavioral.map((q) => q.questionId),
    });
  }

  return patterns;
};

const buildStudentPracticeInsights = async (
  {
    session,
    evaluationRun,
    questionEvaluations = [],
    competencyEvaluations = [],
    requirementAssessments = [],
    blueprintDoc = null,
    turns = [],
    qualityReport = null,
  },
  { llmProvider = null } = {}
) => {
  const { preparationCoverage, recommendedFocusTopics } = mapPreparationCoverage({
    requirementAssessments,
    competencyEvaluations,
    blueprintDoc,
  });

  const effectiveCompetencies = competencyEvaluations.map((c) => ({
    competencyId: c.competencyId,
    competencyName: c.competencyName,
    originalAiScore: c.score,
    effectiveScore: c.humanOverride?.revisedScore ?? c.score,
    hasHumanOverride: Boolean(c.humanOverride),
    assessmentStatus: c.assessmentStatus,
    scoreScale: c.scoreScale || 5,
    aggregationMethod: c.aggregationMethod || 'EQUAL_WEIGHT',
    rubricVersion: c.rubricVersion || blueprintDoc?.rubricVersion || '1.0',
    evidenceSupport: c.evidenceSupport,
    strengths: c.strengths || [],
    developmentAreas: c.developmentAreas || [],
    evidenceReferences: c.evidenceReferences || [],
  }));

  const strengths = effectiveCompetencies
    .filter((c) => typeof c.effectiveScore === 'number' && c.effectiveScore >= 3.5)
    .map((c) => ({
      competencyId: c.competencyId,
      competencyName: c.competencyName,
      score: c.effectiveScore,
      evidenceSupport: c.evidenceSupport,
      highlights: c.strengths,
      evidenceReferences: c.evidenceReferences.slice(0, 3),
    }));

  const developmentAreas = effectiveCompetencies
    .filter(
      (c) =>
        (typeof c.effectiveScore === 'number' && c.effectiveScore < 3.5) ||
        (c.developmentAreas && c.developmentAreas.length > 0)
    )
    .map((c) => ({
      competencyId: c.competencyId,
      competencyName: c.competencyName,
      score: c.effectiveScore,
      assessmentStatus: c.assessmentStatus,
      areas: c.developmentAreas,
      evidenceReferences: c.evidenceReferences.slice(0, 3),
    }));

  const turnByQId = new Map();
  for (const t of turns) {
    if (t.speaker === 'CANDIDATE' && t.questionId && !turnByQId.has(t.questionId)) {
      turnByQId.set(t.questionId, t);
    }
  }

  const questionFeedback = questionEvaluations
    .filter((q) => q.evaluationStatus !== 'NOT_ASKED')
    .map((q) => {
      const candidateTurn = turnByQId.get(q.questionId);
      const ansText = candidateTurn?.spokenText || candidateTurn?.rawTranscript || '';
      return {
        questionId: q.questionId,
        competencyId: q.competencyId || null,
        questionType: q.questionType || 'TECHNICAL',
        questionText: q.questionText || `Question ${q.questionId}`,
        studentAnswerSummary:
          ansText.length > 240 ? `${ansText.slice(0, 237)}...` : ansText || 'No transcript recorded.',
        evaluationStatus: q.evaluationStatus,
        score: q.rating,
        whatWasGood: q.strengths || [],
        whatWasMissing: q.missingEvidence || [],
        improvements: q.improvements || [],
        evidenceReferences: q.evidenceReferences || [],
      };
    });

  const answerImprovementGuidance = await buildAnswerImprovementGuidance(
    { questionEvaluations, turns },
    { llmProvider }
  );

  const coverageSummary = evaluationRun.coverageSummary || {};
  const reportStatus = classifyStudentReportStatus({
    evaluationRun,
    qualityReport,
    preparationCoverage,
    coverageSummary,
  });

  const reviewStateLabel =
    evaluationRun.reviewStatus === 'APPROVED' || evaluationRun.reviewStatus === 'REVIEWED'
      ? 'HUMAN_REVIEWED'
      : evaluationRun.reviewStatus === 'REVIEW_IN_PROGRESS'
      ? 'AWAITING_REVIEW'
      : 'AI_ONLY';

  const practiceMode = session.practiceMode || 'REALISTIC_MOCK';
  const overallPracticeScore =
    evaluationRun.status === 'INSUFFICIENT_COVERAGE' ? null : evaluationRun.overallScore ?? null;

  const performancePatterns = detectPerformancePatterns({ questionEvaluations, turns });
  const dataQualityWarnings = buildStudentQualityNotice(qualityReport);

  const recommendedMode =
    developmentAreas.length === 1
      ? 'FOCUSED_SKILL_PRACTICE'
      : practiceMode === 'REALISTIC_MOCK' && developmentAreas.length > 0
      ? 'GUIDED_PRACTICE'
      : 'REALISTIC_MOCK';

  const recommendedNextPractice = {
    competenciesToPractise: developmentAreas.map((d) => ({
      competencyId: d.competencyId,
      competencyName: d.competencyName,
    })),
    conceptsToRevise: recommendedFocusTopics.map((t) => t.topic),
    followUpTopics: recommendedFocusTopics.map((t) => t.suggestedPracticePrompt),
    recommendedPracticeMode: recommendedMode,
  };

  const practiceSummary = {
    interviewType: session.interviewType || 'MIXED',
    practiceMode,
    targetRole: session.targetRole || '',
    interviewDate: session.completedAt || session.createdAt || new Date(),
    durationSeconds: session.totalDurationSeconds || null,
    assessmentCoverage: Number(coverageSummary.assessmentCoverage || 0),
    overallPracticeScore,
    evaluationCompleteness: evaluationRun.status,
    modeComparisonNote:
      practiceMode === 'GUIDED_PRACTICE'
        ? 'Guided practice allows hints and clarifications; compare scores only with other Guided Practice sessions.'
        : null,
  };

  let coachingSummary =
    `You completed a ${practiceMode.toLowerCase().replace(/_/g, ' ')} interview for ${session.targetRole}. ` +
    `You demonstrated ${strengths.length} strong area(s) and have ${developmentAreas.length} targeted area(s) to sharpen next.`;
  let llmMetadata = null;

  if (llmProvider) {
    try {
      // Send only evaluation metrics — zero unnecessary PII
      const res = await llmProvider.generateStructuredJson({
        systemInstruction: [
          'You are an encouraging EVALIX student interview coach.',
          'Summarise the student practice session constructively without any hiring verdict or discouraging wording.',
          'Return JSON: { "coachingSummary": "..." }',
        ].join('\n'),
        userPrompt: JSON.stringify({
          targetRole: session.targetRole,
          practiceMode,
          reportStatus,
          strengths: strengths.map((s) => s.competencyName),
          developmentAreas: developmentAreas.map((d) => d.competencyName),
        }),
        requestId: `student_fb_${session.sessionId || session._id}`,
      });
      const parsed = coachingSummarySchema.safeParse(res?.data);
      if (parsed.success) {
        coachingSummary = parsed.data.coachingSummary;
        llmMetadata = {
          provider: res.provider || 'gemini',
          model: res.model || env.AI_EXTRACTION_MODEL,
          promptVersion: STUDENT_FEEDBACK_PROMPT_VERSION,
        };
      }
    } catch (_err) {
      // Deterministic summary preserved
    }
  }

  return {
    practiceMode,
    focusedCompetencyId: session.focusedCompetencyId || null,
    targetRole: session.targetRole || '',
    reportStatus,
    reviewStateLabel,
    overallPracticeScore,
    assessmentCoverage: Number(coverageSummary.assessmentCoverage || 0),
    practiceSummary,
    strengths,
    developmentAreas,
    questionFeedback,
    answerImprovementGuidance,
    competencyInsights: effectiveCompetencies,
    preparationCoverage,
    performancePatterns,
    recommendedNextPractice,
    dataQualityWarnings,
    coachingSummary,
    llmMetadata,
    sourceVersions: {
      blueprintVersion: session.blueprintVersion,
      evaluationVersion: evaluationRun.evaluationVersion,
      evaluatorVersion: evaluationRun.evaluatorVersion,
      reviewVersion: evaluationRun.latestReviewVersion || 0,
      practiceMode,
      difficulty: session.seniorityLevel || blueprintDoc?.seniorityLevel || 'MID',
      rubricVersion: blueprintDoc?.rubricVersion || '1.0',
      scoreScale: 5,
      aggregationMethod: 'EQUAL_WEIGHT',
    },
  };
};

module.exports = {
  buildStudentPracticeInsights,
  classifyStudentReportStatus,
  detectPerformancePatterns,
  STUDENT_FEEDBACK_PROMPT_VERSION,
};
