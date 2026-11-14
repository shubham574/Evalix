const asyncHandler = require('../../utils/asyncHandler');
const service = require('./interview-blueprint.service');

exports.generate = asyncHandler(async (req, res) => {
  const data = await service.requestBlueprintGeneration(
    req.auth.userId,
    req.params.intakeId,
    req.body
  );
  res.status(data.reused ? 200 : 202).json({ success: true, data });
});

exports.regenerate = asyncHandler(async (req, res) => {
  const data = await service.regenerateBlueprint(
    req.auth.userId,
    req.params.intakeId,
    req.body
  );
  res.status(202).json({ success: true, data });
});

exports.getStatus = asyncHandler(async (req, res) => {
  const data = await service.getBlueprintStatus(req.auth.userId, req.params.intakeId);
  res.status(200).json({ success: true, data });
});

exports.getCurrent = asyncHandler(async (req, res) => {
  const data = await service.getCurrentCandidateBlueprint(req.auth.userId, req.params.intakeId);
  res.status(200).json({ success: true, data });
});

exports.getHistory = asyncHandler(async (req, res) => {
  const data = await service.getBlueprintHistory(req.auth.userId, req.params.intakeId);
  res.status(200).json({ success: true, data });
});

exports.getById = asyncHandler(async (req, res) => {
  const data = await service.getCandidateBlueprintById(
    req.auth.userId,
    req.params.intakeId,
    req.params.blueprintId
  );
  res.status(200).json({ success: true, data });
});

exports.getQuestions = asyncHandler(async (req, res) => {
  const data = await service.getCandidateBlueprintQuestions(
    req.auth.userId,
    req.params.intakeId,
    req.params.blueprintId
  );
  res.status(200).json({ success: true, data });
});

exports.getInternal = asyncHandler(async (req, res) => {
  const data = await service.getInternalOrchestratorBlueprint(
    req.params.intakeId,
    req.params.blueprintId
  );
  res.status(200).json({ success: true, data });
});
