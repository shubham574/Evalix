const env = require('../../../config/env');

const getAllBlueprintQuestions = (blueprint) => {
  const core = Array.isArray(blueprint.coreQuestions) ? blueprint.coreQuestions : [];
  const personalised = Array.isArray(blueprint.personalisedQuestions)
    ? blueprint.personalisedQuestions
    : [];
  const plan = Array.isArray(blueprint.questionPlan) ? blueprint.questionPlan : [];
  const byId = new Map();
  for (const q of [...core, ...personalised, ...plan]) {
    if (q && q.questionId && !byId.has(q.questionId)) {
      byId.set(q.questionId, q);
    }
  }
  return Array.from(byId.values());
};

const findQuestionById = (blueprint, questionId) => {
  if (!questionId) return null;
  return getAllBlueprintQuestions(blueprint).find((q) => q.questionId === questionId) || null;
};

const getOrderedQuestionsForStage = (blueprint, stageId, stageProgressEntry = null) => {
  const all = getAllBlueprintQuestions(blueprint);
  const planEntries = Array.isArray(blueprint.questionPlan)
    ? blueprint.questionPlan.filter((item) => item.stageId === stageId)
    : [];

  if (planEntries.length > 0) {
    const ordered = [];
    for (const item of planEntries) {
      const found = all.find((q) => q.questionId === item.questionId);
      if (found) ordered.push(found);
    }
    if (ordered.length > 0) return ordered;
  }

  if (stageProgressEntry && Array.isArray(stageProgressEntry.questionIds) && stageProgressEntry.questionIds.length > 0) {
    const ordered = [];
    for (const qId of stageProgressEntry.questionIds) {
      const found = all.find((q) => q.questionId === qId);
      if (found) ordered.push(found);
    }
    if (ordered.length > 0) return ordered;
  }

  return all.filter((q) => q.stageId === stageId);
};

const getNextUnaskedQuestion = (session, blueprint, stageId) => {
  const stageEntry = (session.stageProgress || []).find((s) => s.stageId === stageId);
  const stageQuestions = getOrderedQuestionsForStage(blueprint, stageId, stageEntry);
  const asked = new Set(session.askedQuestionIds || []);
  return stageQuestions.find((q) => !asked.has(q.questionId)) || null;
};

const markQuestionAsked = (session, question) => {
  if (!question || !question.questionId) return;
  const qId = question.questionId;

  if (!session.askedQuestionIds.includes(qId)) {
    session.askedQuestionIds.push(qId);
  }

  const stage = (session.stageProgress || []).find((s) => s.stageId === session.currentStageId);
  if (stage && !stage.askedQuestionIds.includes(qId)) {
    stage.askedQuestionIds.push(qId);
  }

  if (question.competencyId && !session.coveredCompetencyIds.includes(question.competencyId)) {
    session.coveredCompetencyIds.push(question.competencyId);
  }

  session.currentQuestionId = qId;
  session.currentQuestionIndex = session.askedQuestionIds.indexOf(qId);
  session.currentFollowUpCount = Number(session.followUpsPerQuestion?.[qId] || 0);
};

const markQuestionCompleted = (session, questionId) => {
  if (!questionId) return;
  if (!session.completedQuestionIds.includes(questionId)) {
    session.completedQuestionIds.push(questionId);
  }
  const stage = (session.stageProgress || []).find((s) => s.stageId === session.currentStageId);
  if (stage && !stage.completedQuestionIds.includes(questionId)) {
    stage.completedQuestionIds.push(questionId);
  }
};

const incrementFollowUpCount = (session, questionId) => {
  if (!questionId) return 0;
  const map = { ...(session.followUpsPerQuestion || {}) };
  const next = (Number(map[questionId]) || 0) + 1;
  map[questionId] = next;
  session.followUpsPerQuestion = map;
  session.markModified('followUpsPerQuestion');
  session.currentFollowUpCount = next;
  return next;
};

const getFollowUpPolicy = (blueprint, questionId = null) => {
  const question = findQuestionById(blueprint, questionId);
  const policies = blueprint.followUpPolicies;
  let specific = question?.followUpPolicy || null;

  if (!specific && policies) {
    if (Array.isArray(policies)) {
      specific = question
        ? policies.find(
            (p) =>
              p.questionId === questionId ||
              (question.competencyId && p.competencyId === question.competencyId)
          )
        : null;
    } else if (typeof policies === 'object' && questionId) {
      specific = policies[questionId] || null;
    }
  }

  const maxFollowUps = Math.min(
    env.INTERVIEW_ORCHESTRATOR_MAX_FOLLOW_UPS_PER_QUESTION,
    Number(
      question?.maxFollowUps ??
        specific?.maxFollowUps ??
        env.INTERVIEW_ORCHESTRATOR_MAX_FOLLOW_UPS_PER_QUESTION
    )
  );

  const allowedProbeTypes = Array.isArray(specific?.allowedProbeTypes) && specific.allowedProbeTypes.length > 0
    ? specific.allowedProbeTypes
    : ['CLARIFICATION', 'DEPTH_PROBE', 'TRADEOFF_PROBE', 'EXAMPLE_PROBE', 'EDGE_CASE_PROBE'];

  return {
    maxFollowUps: Math.max(0, maxFollowUps),
    allowedProbeTypes,
  };
};

module.exports = {
  getAllBlueprintQuestions,
  findQuestionById,
  getOrderedQuestionsForStage,
  getNextUnaskedQuestion,
  markQuestionAsked,
  markQuestionCompleted,
  incrementFollowUpCount,
  getFollowUpPolicy,
};
