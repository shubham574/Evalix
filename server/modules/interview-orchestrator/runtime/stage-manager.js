const initializeStageProgress = (blueprint) => {
  const stages = Array.isArray(blueprint.stages) ? blueprint.stages : [];
  const allQuestions = [
    ...(Array.isArray(blueprint.coreQuestions) ? blueprint.coreQuestions : []),
    ...(Array.isArray(blueprint.personalisedQuestions) ? blueprint.personalisedQuestions : []),
    ...(Array.isArray(blueprint.questionPlan) ? blueprint.questionPlan : []),
  ];

  return stages.map((stage, idx) => {
    const stageQuestionIds =
      Array.isArray(stage.questionIds) && stage.questionIds.length > 0
        ? stage.questionIds
        : Array.from(
            new Set(
              allQuestions
                .filter((q) => q.stageId === stage.stageId)
                .map((q) => q.questionId)
            )
          );

    return {
      stageId: stage.stageId,
      stageType: stage.stageType || stage.type || 'CORE_ASSESSMENT',
      title: stage.stageName || stage.title || stage.name || stage.stageId,
      status: idx === 0 ? 'ACTIVE' : 'PENDING',
      allocatedDurationSeconds: Number(stage.allocatedDurationSeconds || stage.durationSeconds || 300),
      elapsedSeconds: 0,
      startedAt: idx === 0 ? new Date() : null,
      completedAt: null,
      questionIds: stageQuestionIds,
      askedQuestionIds: [],
      completedQuestionIds: [],
    };
  });
};

const getCurrentStage = (session) => {
  const progress = session.stageProgress || [];
  if (session.currentStageId) {
    const found = progress.find((s) => s.stageId === session.currentStageId);
    if (found) return found;
  }
  return progress[session.currentStageIndex || 0] || null;
};

const getNextStage = (session) => {
  const progress = session.stageProgress || [];
  const currentIdx = progress.findIndex((s) => s.stageId === session.currentStageId);
  if (currentIdx === -1) return null;
  for (let i = currentIdx + 1; i < progress.length; i += 1) {
    if (progress[i].status === 'PENDING') {
      return { stage: progress[i], index: i };
    }
  }
  return null;
};

const advanceStage = (session, now = new Date()) => {
  const current = getCurrentStage(session);
  if (current && current.status === 'ACTIVE') {
    current.status = 'COMPLETED';
    current.completedAt = now;
  }

  const next = getNextStage(session);
  if (!next) {
    return {
      previousStageId: current?.stageId || null,
      nextStage: null,
      allStagesCompleted: true,
    };
  }

  next.stage.status = 'ACTIVE';
  next.stage.startedAt = now;
  session.currentStageId = next.stage.stageId;
  session.currentStageIndex = next.index;
  session.currentQuestionId = null;
  session.currentFollowUpCount = 0;

  return {
    previousStageId: current?.stageId || null,
    nextStage: next.stage,
    allStagesCompleted: false,
  };
};

const isOpeningOrGreetingStage = (stage) => {
  if (!stage) return false;
  const type = String(stage.stageType || '').toUpperCase();
  return type === 'OPENING' || type === 'INTRODUCTION' || type === 'WARMUP';
};

const isClosingStage = (stage) => {
  if (!stage) return false;
  const type = String(stage.stageType || '').toUpperCase();
  return type === 'CLOSING' || type === 'WRAP_UP' || type === 'CANDIDATE_QUESTIONS';
};

module.exports = {
  initializeStageProgress,
  getCurrentStage,
  getNextStage,
  advanceStage,
  isOpeningOrGreetingStage,
  isClosingStage,
};
