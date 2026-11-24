const { z } = require('zod');
const env = require('../../../config/env');
const { mapRequirementInsights } = require('./requirement-summary.service');

const NARRATIVE_PROMPT_VERSION = 'module7.recruiter_narrative.v1';

const narrativeSchema = z.object({
  narrativeSummary: z.string().min(10).max(1200),
});

const classifyDecisionSupportStatus = ({
  evaluationRun,
  qualityReport,
  requirementInsights = [],
  coverageSummary = {},
}) => {
  if (
    qualityReport?.qualityStatus === 'FAILED' ||
    evaluationRun.status === 'NEEDS_REVIEW' ||
    requirementInsights.some((r) => r.interviewStatus === 'REVIEW_REQUIRED')
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

  const mustHaves = requirementInsights.filter((r) => r.requirementType === 'MUST_HAVE');
  const pool = mustHaves.length > 0 ? mustHaves : requirementInsights;
  const demonstratedCount = pool.filter((r) => r.interviewStatus === 'DEMONSTRATED').length;
  const partialOrWeakCount = pool.filter(
    (r) =>
      r.interviewStatus === 'PARTIALLY_DEMONSTRATED' ||
      r.interviewStatus === 'NOT_DEMONSTRATED_IN_INTERVIEW'
  ).length;

  if (pool.length > 0 && demonstratedCount === pool.length) {
    return 'STRONG_EVIDENCE_OF_REQUIREMENT_COVERAGE';
  }
  if (demonstratedCount > 0 && partialOrWeakCount > 0) {
    return 'MIXED_EVIDENCE';
  }
  if (demonstratedCount > 0) {
    return 'STRONG_EVIDENCE_OF_REQUIREMENT_COVERAGE';
  }
  return 'LIMITED_EVIDENCE';
};

const buildRecruiterDecisionSupport = async (
  {
    session,
    candidateProfile,
    evaluationRun,
    questionEvaluations,
    competencyEvaluations,
    requirementAssessments,
    blueprintDoc,
    qualityReport,
  },
  { llmProvider = null } = {}
) => {
  const { requirementInsights, clarificationItems } = mapRequirementInsights({
    requirementAssessments,
    competencyEvaluations,
    blueprintDoc,
  });

  // Effective competency views (applying humanOverride when present while preserving originalAiScore)
  const effectiveCompetencies = competencyEvaluations.map((c) => ({
    competencyId: c.competencyId,
    competencyName: c.competencyName,
    originalAiScore: c.score,
    effectiveScore: c.humanOverride?.revisedScore ?? c.score,
    hasHumanOverride: Boolean(c.humanOverride),
    assessmentStatus: c.assessmentStatus,
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
      areas: c.developmentAreas,
      evidenceReferences: c.evidenceReferences.slice(0, 2),
    }));

  const reviewStateLabel =
    evaluationRun.reviewStatus === 'APPROVED' ||
    evaluationRun.reviewStatus === 'ACCEPTED' ||
    evaluationRun.reviewStatus === 'ADJUSTED'
      ? 'HUMAN_REVIEWED'
      : evaluationRun.reviewStatus === 'REVIEW_REQUESTED'
      ? 'AWAITING_REVIEW'
      : 'AI_ONLY';

  const coverageSummary = evaluationRun.coverageSummary || {};
  const decisionSupportStatus = classifyDecisionSupportStatus({
    evaluationRun,
    qualityReport,
    requirementInsights,
    coverageSummary,
  });

  const professionalOverview = {
    targetRole: session.targetRole,
    seniorityLevel: session.seniorityLevel,
    interviewType: session.interviewType,
    activeDurationSeconds: session.activeDurationSeconds || 0,
    candidateCurrentTitle: candidateProfile?.currentJobTitle || null,
    totalExperienceMonths: candidateProfile?.totalExperienceMonths ?? null,
    experienceLevel: candidateProfile?.experienceLevel || null,
  };

  const assessmentSummary = {
    decisionSupportStatus,
    reviewStateLabel,
    humanReviewStatus: evaluationRun.reviewStatus,
    overallScore: evaluationRun.evaluationSummary?.overallScore ?? null,
    overallStatus: evaluationRun.evaluationSummary?.overallStatus || evaluationRun.status,
    advisoryOnly: true,
    automatedDecisionMade: false,
  };

  let narrativeSummary = `Assessment summary (${decisionSupportStatus}, ${reviewStateLabel}): evaluated ${
    coverageSummary.evaluatedQuestions || 0
  } of ${coverageSummary.plannedQuestions || 0} planned questions (${
    coverageSummary.assessmentCoverage || 0
  }% coverage).`;
  let llmMetadata = null;

  if (llmProvider) {
    try {
      const res = await llmProvider.generateStructuredJson({
        systemInstruction:
          'Summarize verified interview assessment facts concisely for a human recruiter. Never make a hiring/rejection recommendation and never invent evidence.',
        userPrompt: JSON.stringify({
          decisionSupportStatus,
          reviewStateLabel,
          strengths: strengths.map((s) => ({ name: s.competencyName, score: s.score })),
          developmentAreas: developmentAreas.map((d) => ({ name: d.competencyName, areas: d.areas })),
          clarificationCount: clarificationItems.length,
        }),
        requestId: `ds_narr_${session.sessionId}`,
      });
      const parsed = narrativeSchema.safeParse(res?.data);
      if (parsed.success) {
        narrativeSummary = parsed.data.narrativeSummary;
        llmMetadata = {
          provider: res.provider || 'gemini',
          model: res.model || env.AI_EXTRACTION_MODEL,
          promptVersion: NARRATIVE_PROMPT_VERSION,
        };
      }
    } catch (_err) {
      // Safe deterministic narrative fallback already populated
    }
  }

  return {
    humanReviewStatus: evaluationRun.reviewStatus,
    reviewStateLabel,
    decisionSupportStatus,
    professionalOverview,
    assessmentSummary,
    requirementInsights,
    strengths,
    developmentAreas,
    coverageSummary,
    clarificationItems,
    qualityFlags: qualityReport?.qualityFlags || [],
    sourceVersions: {
      blueprintVersion: session.blueprintVersion,
      evaluationVersion: evaluationRun.evaluationVersion,
      evaluatorVersion: evaluationRun.evaluatorVersion,
    },
    narrativeSummary,
    llmMetadata,
  };
};

module.exports = {
  classifyDecisionSupportStatus,
  buildRecruiterDecisionSupport,
  NARRATIVE_PROMPT_VERSION,
};
