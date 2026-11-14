const PREPARATION_STATUSES = [
  'DEMONSTRATED_IN_PRACTICE',
  'PARTIALLY_DEMONSTRATED',
  'NEEDS_MORE_PRACTICE',
  'NOT_ASSESSED',
  'INSUFFICIENT_EVIDENCE',
  'REVIEW_REQUIRED',
];

/**
 * Maps Module 3 job-requirement assessments and Module 6 competency evaluations
 * into student-facing Interview Preparation Coverage.
 * NOT_ASSESSED or NOT_EVIDENCED never implies the student lacks the skill.
 */
const mapPreparationCoverage = ({
  requirementAssessments = [],
  competencyEvaluations = [],
  blueprintDoc = null,
}) => {
  const compPlan = Array.isArray(blueprintDoc?.competencyPlan)
    ? blueprintDoc.competencyPlan
    : [];

  const compEvalById = new Map(
    competencyEvaluations.map((c) => [c.competencyId, c])
  );

  const compByReqId = new Map();
  for (const cp of compPlan) {
    for (const reqId of cp.sourceRequirementIds || []) {
      compByReqId.set(reqId, cp.competencyId);
    }
  }

  const preparationCoverage = [];
  const recommendedFocusTopics = [];

  for (const req of requirementAssessments) {
    const linkedCompId = compByReqId.get(req.requirementId) || null;
    const compEval = linkedCompId ? compEvalById.get(linkedCompId) : null;

    const effectiveScore = compEval?.humanOverride?.revisedScore ?? compEval?.score ?? null;
    const hasHumanOverride = Boolean(compEval?.humanOverride);

    let practiceStatus = 'NOT_ASSESSED';
    if (compEval) {
      if (compEval.assessmentStatus === 'REVIEW_REQUIRED') {
        practiceStatus = 'REVIEW_REQUIRED';
      } else if (compEval.assessmentStatus === 'INSUFFICIENT_EVIDENCE') {
        practiceStatus = 'INSUFFICIENT_EVIDENCE';
      } else if (compEval.assessmentStatus === 'NOT_ASSESSED' || effectiveScore === null) {
        practiceStatus = 'NOT_ASSESSED';
      } else if (effectiveScore >= 3.5) {
        practiceStatus = 'DEMONSTRATED_IN_PRACTICE';
      } else if (effectiveScore >= 2.5) {
        practiceStatus = 'PARTIALLY_DEMONSTRATED';
      } else {
        practiceStatus = 'NEEDS_MORE_PRACTICE';
      }
    }

    const provenance = [];
    if (
      req.assessment === 'SUPPORTED_DIRECTLY' ||
      req.assessment === 'SUPPORTED_BY_TRANSFERABLE_EVIDENCE' ||
      req.assessment === 'PARTIALLY_SUPPORTED'
    ) {
      provenance.push('RESUME_EVIDENCE');
    }
    if (compEval && effectiveScore !== null) {
      provenance.push('PRACTICE_INTERVIEW_EVIDENCE');
    }
    if (hasHumanOverride) {
      provenance.push('REVIEWED_FEEDBACK');
    }

    let coachingExplanation = '';
    if (practiceStatus === 'DEMONSTRATED_IN_PRACTICE') {
      coachingExplanation = `You demonstrated ${req.requirementName} well in this practice session (${effectiveScore}/5).`;
    } else if (practiceStatus === 'PARTIALLY_DEMONSTRATED') {
      coachingExplanation = `You covered core parts of ${req.requirementName} (${effectiveScore}/5). Adding deeper trade-offs and concrete examples will strengthen your answer.`;
    } else if (practiceStatus === 'NEEDS_MORE_PRACTICE') {
      coachingExplanation = `Your response on ${req.requirementName} (${effectiveScore}/5) showed room to deepen your explanation and practical examples.`;
    } else if (practiceStatus === 'INSUFFICIENT_EVIDENCE') {
      coachingExplanation = `There was not enough response detail for ${req.requirementName} in this session to form reliable practice feedback.`;
    } else {
      coachingExplanation = `${req.requirementName} was not assessed during this mock interview. This does not mean you lack the skill — consider practising it in a focused session.`;
    }

    if (
      practiceStatus === 'NOT_ASSESSED' ||
      practiceStatus === 'INSUFFICIENT_EVIDENCE' ||
      practiceStatus === 'NEEDS_MORE_PRACTICE'
    ) {
      recommendedFocusTopics.push({
        requirementId: req.requirementId,
        topic: req.requirementName,
        reason: practiceStatus,
        suggestedPracticePrompt: `Practise explaining ${req.requirementName} with a concrete project example and key trade-offs.`,
      });
    }

    preparationCoverage.push({
      requirementId: req.requirementId,
      requirementName: req.requirementName,
      requirementType: req.requirementType,
      resumeProfileStatus: req.assessment,
      linkedCompetencyId: linkedCompId,
      practiceStatus,
      originalAiScore: compEval?.score ?? null,
      effectiveScore,
      hasHumanOverride,
      provenance,
      evidenceReferences: compEval?.evidenceReferences || [],
      coachingExplanation,
      note:
        practiceStatus === 'NOT_ASSESSED'
          ? 'Not assessed in this session; does not indicate lack of skill.'
          : null,
    });
  }

  return {
    preparationCoverage,
    recommendedFocusTopics,
    // Backward-compatible aliases for internal callers
    requirementInsights: preparationCoverage,
    clarificationItems: recommendedFocusTopics,
  };
};

module.exports = {
  mapPreparationCoverage,
  mapRequirementInsights: mapPreparationCoverage,
  PREPARATION_STATUSES,
};
