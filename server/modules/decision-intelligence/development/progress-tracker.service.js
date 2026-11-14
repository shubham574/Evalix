const mongoose = require('mongoose');
const AppError = require('../../common/errors/AppError');
const { CandidateDevelopmentPlan } = require('./candidateDevelopmentPlan.model');
const { DevelopmentProgressEvent } = require('./developmentProgressEvent.model');

const ACTION_TO_STATUS = {
  STARTED: 'IN_PROGRESS',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  REVISITED: 'IN_PROGRESS',
  MARKED_FOR_REVIEW: 'NEEDS_REVIEW',
};

const recordObjectiveProgress = async ({
  planId,
  userId,
  objectiveId,
  action,
  candidateNotes = '',
}) => {
  if (!mongoose.isValidObjectId(planId)) {
    throw new AppError(400, 'Invalid development plan ID', 'INVALID_PLAN_ID');
  }

  const plan = await CandidateDevelopmentPlan.findById(planId);
  if (!plan) {
    throw new AppError(404, 'Candidate development plan not found', 'PLAN_NOT_FOUND');
  }
  if (plan.userId !== userId) {
    throw new AppError(403, 'Not authorized to update this development plan', 'PLAN_FORBIDDEN');
  }

  const objIndex = (plan.objectives || []).findIndex((o) => o.objectiveId === objectiveId);
  if (objIndex === -1) {
    throw new AppError(404, 'Development objective not found in plan', 'OBJECTIVE_NOT_FOUND');
  }

  const progressStatus = ACTION_TO_STATUS[action] || 'IN_PROGRESS';
  plan.objectives[objIndex].progressStatus = progressStatus;
  plan.markModified('objectives');

  const allCompleted = plan.objectives.every((o) => o.progressStatus === 'COMPLETED');
  if (allCompleted) {
    plan.status = 'COMPLETED';
  }
  await plan.save();

  const evt = await DevelopmentProgressEvent.create({
    developmentPlanId: plan._id,
    candidateProfileId: plan.candidateProfileId,
    userId,
    objectiveId,
    action,
    progressStatus,
    candidateNotes,
  });

  return {
    plan: plan.toObject(),
    progressEvent: evt.toObject(),
  };
};

const getProgressHistory = async ({ planId, userId }) => {
  if (!mongoose.isValidObjectId(planId)) {
    throw new AppError(400, 'Invalid development plan ID', 'INVALID_PLAN_ID');
  }
  const plan = await CandidateDevelopmentPlan.findById(planId).lean();
  if (!plan) {
    throw new AppError(404, 'Candidate development plan not found', 'PLAN_NOT_FOUND');
  }
  if (plan.userId !== userId) {
    throw new AppError(403, 'Not authorized to access this development plan', 'PLAN_FORBIDDEN');
  }
  const events = await DevelopmentProgressEvent.find({ developmentPlanId: plan._id })
    .sort({ createdAt: 1 })
    .lean();
  return { plan, events };
};

module.exports = {
  recordObjectiveProgress,
  getProgressHistory,
};
