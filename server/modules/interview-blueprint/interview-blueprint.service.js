const mongoose = require('mongoose');
const AppError = require('../common/errors/AppError');
const { InterviewIntake } = require('../intake/interviewIntake.model');
const blueprintRepo = require('./interview-blueprint.repository');
const blueprintJobRepo = require('./jobs/blueprint-job.repository');
const { enqueueBlueprintGeneration } = require('./planner/blueprint-orchestrator');
const {
  toCandidateFacingBlueprint,
  toCandidateFacingQuestions,
  toInternalOrchestratorBlueprint,
} = require('./serializers/blueprint.serializer');

const verifyOwnedIntake = async (intakeId, userId) => {
  if (!mongoose.isValidObjectId(intakeId)) {
    throw new AppError(400, 'Invalid interview intake ID', 'INVALID_INTAKE_ID');
  }
  const intake = await InterviewIntake.findOne({ _id: intakeId, userId }).lean();
  if (!intake) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }
  return intake;
};

const requestBlueprintGeneration = async (userId, intakeId, body = {}) => {
  await verifyOwnedIntake(intakeId, userId);
  const res = await enqueueBlueprintGeneration(intakeId, {
    userId,
    interviewType: body.interviewType,
    durationMinutes: body.durationMinutes,
    regenerate: false,
    requeueFailed: true,
  });

  return {
    intakeId: String(intakeId),
    reused: res.reused,
    blueprintId: res.blueprint ? String(res.blueprint._id) : null,
    blueprintStatus: res.blueprint?.status || null,
    jobId: res.job ? String(res.job._id) : null,
    jobStatus: res.job?.status || (res.reused ? 'COMPLETED' : 'QUEUED'),
  };
};

const regenerateBlueprint = async (userId, intakeId, body = {}) => {
  await verifyOwnedIntake(intakeId, userId);
  const res = await enqueueBlueprintGeneration(intakeId, {
    userId,
    interviewType: body.interviewType,
    durationMinutes: body.durationMinutes,
    regenerate: true,
    requeueFailed: true,
    regenerationReason: body.reason || 'Candidate requested blueprint regeneration',
  });

  return {
    intakeId: String(intakeId),
    reused: false,
    jobId: res.job ? String(res.job._id) : null,
    jobStatus: res.job?.status || 'QUEUED',
  };
};

const getBlueprintStatus = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  const [bp, job] = await Promise.all([
    blueprintRepo.findLatestByIntakeAndUser(intakeId, userId),
    blueprintJobRepo.findLatestJobByIntakeAndUser(intakeId, userId),
  ]);

  if (!bp && !job) {
    return {
      intakeId: String(intakeId),
      blueprintId: null,
      status: 'NOT_STARTED',
      blueprintVersion: null,
      generationStage: 'NOT_REQUESTED',
      lastErrorCode: null,
      completedAt: null,
    };
  }

  return {
    intakeId: String(intakeId),
    blueprintId: bp ? String(bp._id) : null,
    status: bp?.status || job?.status || 'QUEUED',
    blueprintVersion: bp?.blueprintVersion ?? null,
    generationStage: job?.failureStage || job?.status || (bp ? 'COMPLETED' : 'QUEUED'),
    lastErrorCode: job?.lastErrorCode || null,
    completedAt: bp?.createdAt || null,
  };
};

const getCurrentCandidateBlueprint = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  const bp = await blueprintRepo.findLatestReadyOrReviewByIntakeAndUser(intakeId, userId);
  if (!bp) {
    throw new AppError(404, 'No ready interview blueprint found', 'BLUEPRINT_NOT_FOUND');
  }
  return toCandidateFacingBlueprint(bp);
};

const getCandidateBlueprintById = async (userId, intakeId, blueprintId) => {
  await verifyOwnedIntake(intakeId, userId);
  if (!mongoose.isValidObjectId(blueprintId)) {
    throw new AppError(400, 'Invalid blueprint ID', 'INVALID_BLUEPRINT_ID');
  }
  const bp = await blueprintRepo.findByIdAndIntakeAndUser(blueprintId, intakeId, userId);
  if (!bp) {
    throw new AppError(404, 'Interview blueprint not found', 'BLUEPRINT_NOT_FOUND');
  }
  return toCandidateFacingBlueprint(bp);
};

const getCandidateBlueprintQuestions = async (userId, intakeId, blueprintId) => {
  await verifyOwnedIntake(intakeId, userId);
  if (!mongoose.isValidObjectId(blueprintId)) {
    throw new AppError(400, 'Invalid blueprint ID', 'INVALID_BLUEPRINT_ID');
  }
  const bp = await blueprintRepo.findByIdAndIntakeAndUser(blueprintId, intakeId, userId);
  if (!bp) {
    throw new AppError(404, 'Interview blueprint not found', 'BLUEPRINT_NOT_FOUND');
  }
  return {
    blueprintId: String(bp._id),
    blueprintVersion: bp.blueprintVersion,
    questions: toCandidateFacingQuestions(bp),
  };
};

const getBlueprintHistory = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  return blueprintRepo.listHistoryByIntakeAndUser(intakeId, userId);
};

const getInternalOrchestratorBlueprint = async (intakeId, blueprintId) => {
  if (!mongoose.isValidObjectId(intakeId) || !mongoose.isValidObjectId(blueprintId)) {
    throw new AppError(400, 'Invalid intake or blueprint ID', 'INVALID_ID');
  }
  const bp = await blueprintRepo.findByIdInternal(blueprintId, intakeId);
  if (!bp) {
    throw new AppError(404, 'Interview blueprint not found', 'BLUEPRINT_NOT_FOUND');
  }
  return toInternalOrchestratorBlueprint(bp);
};

module.exports = {
  requestBlueprintGeneration,
  regenerateBlueprint,
  getBlueprintStatus,
  getCurrentCandidateBlueprint,
  getCandidateBlueprintById,
  getCandidateBlueprintQuestions,
  getBlueprintHistory,
  getInternalOrchestratorBlueprint,
};
