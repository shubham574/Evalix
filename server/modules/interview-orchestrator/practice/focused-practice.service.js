const env = require('../../../config/env');
const ApiError = require('../../../utils/ApiError');

/**
 * Builds an immutable execution snapshot for FOCUSED_SKILL_PRACTICE without mutating
 * the locked InterviewBlueprint.
 */
const buildFocusedPracticeSnapshot = ({
  internalBlueprint,
  competencyId,
  maxQuestions = null,
}) => {
  if (!competencyId || typeof competencyId !== 'string' || !competencyId.trim()) {
    throw new ApiError(
      400,
      'competencyId is required when practiceMode is FOCUSED_SKILL_PRACTICE'
    );
  }

  const normalizedCompetencyId = competencyId.trim();
  const competencies = Array.isArray(internalBlueprint?.competencies)
    ? internalBlueprint.competencies
    : [];

  const matchedCompetency = competencies.find(
    (c) => c.competencyId === normalizedCompetencyId
  );

  if (!matchedCompetency) {
    throw new ApiError(
      400,
      `Competency '${normalizedCompetencyId}' does not exist in the locked interview blueprint`
    );
  }

  const allQuestions = Array.isArray(internalBlueprint?.questionPlan)
    ? internalBlueprint.questionPlan
    : [];

  const matchingQuestions = allQuestions.filter((q) => {
    if (q.competencyId === normalizedCompetencyId) return true;
    if (Array.isArray(q.competencyIds) && q.competencyIds.includes(normalizedCompetencyId)) {
      return true;
    }
    return false;
  });

  if (matchingQuestions.length === 0) {
    throw new ApiError(
      409,
      `No questions are available in the locked blueprint for competency '${normalizedCompetencyId}'`
    );
  }

  const configuredLimit = Math.max(1, Number(env.FOCUSED_PRACTICE_MAX_QUESTIONS) || 5);
  let effectiveLimit = configuredLimit;
  if (maxQuestions !== null && maxQuestions !== undefined) {
    const parsed = Number(maxQuestions);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new ApiError(400, 'maxQuestions must be a positive integer');
    }
    effectiveLimit = Math.min(parsed, configuredLimit);
  }

  const selectedQuestions = matchingQuestions.slice(0, effectiveLimit);
  const selectedIds = new Set(selectedQuestions.map((q) => q.questionId));
  const selectedStageIds = new Set(selectedQuestions.map((q) => q.stageId).filter(Boolean));

  const stagePlan = Array.isArray(internalBlueprint?.stagePlan)
    ? internalBlueprint.stagePlan.filter((s) => selectedStageIds.has(s.stageId))
    : [];

  const excludedQuestionIds = allQuestions
    .filter((q) => !selectedIds.has(q.questionId))
    .map((q) => q.questionId);

  return {
    focusedCompetency: matchedCompetency,
    executionSnapshot: {
      practiceMode: 'FOCUSED_SKILL_PRACTICE',
      focusedCompetencyId: normalizedCompetencyId,
      maxQuestions: effectiveLimit,
      stagePlan,
      questionPlan: selectedQuestions,
      competencies: [matchedCompetency],
      excludedQuestionIds,
      createdAt: new Date().toISOString(),
    },
  };
};

/**
 * Returns the effective blueprint view for a session. For FOCUSED_SKILL_PRACTICE,
 * overlays the immutable executionSnapshot onto the locked blueprint without mutating it.
 */
const getEffectiveBlueprintForSession = (session, internalBlueprint) => {
  if (
    session?.practiceMode === 'FOCUSED_SKILL_PRACTICE' &&
    session?.executionSnapshot &&
    Array.isArray(session.executionSnapshot.questionPlan) &&
    session.executionSnapshot.questionPlan.length > 0
  ) {
    return {
      ...internalBlueprint,
      stagePlan:
        Array.isArray(session.executionSnapshot.stagePlan) &&
        session.executionSnapshot.stagePlan.length > 0
          ? session.executionSnapshot.stagePlan
          : internalBlueprint.stagePlan,
      questionPlan: session.executionSnapshot.questionPlan,
    };
  }
  return internalBlueprint;
};

module.exports = {
  buildFocusedPracticeSnapshot,
  getEffectiveBlueprintForSession,
};
