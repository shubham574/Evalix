const loadRubricForQuestion = (internalBlueprint, question) => {
  const rubrics = Array.isArray(internalBlueprint?.evaluationRubrics)
    ? internalBlueprint.evaluationRubrics
    : [];

  if (question.evaluationRubricId) {
    const byId = rubrics.find((r) => r.rubricId === question.evaluationRubricId);
    if (byId) return byId;
  }

  const byQuestion = rubrics.find((r) => r.questionId === question.questionId);
  if (byQuestion) return byQuestion;

  return null;
};

module.exports = {
  loadRubricForQuestion,
};
