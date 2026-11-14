const asyncHandler = require('../../utils/asyncHandler');
const intelligenceService = require('./document-intelligence.service');

exports.getStatus = asyncHandler(async (req, res) => {
  const data = await intelligenceService.getIntelligenceStatus(
    req.auth.userId,
    req.params.intakeId
  );
  res.status(200).json({ success: true, data });
});

exports.getResume = asyncHandler(async (req, res) => {
  const data = await intelligenceService.getExtractedResume(
    req.auth.userId,
    req.params.intakeId
  );
  res.status(200).json({ success: true, data });
});

exports.getJobDescription = asyncHandler(async (req, res) => {
  const data = await intelligenceService.getExtractedJobDescription(
    req.auth.userId,
    req.params.intakeId
  );
  res.status(200).json({ success: true, data });
});

exports.getComplete = asyncHandler(async (req, res) => {
  const data = await intelligenceService.getCompleteIntelligence(
    req.auth.userId,
    req.params.intakeId
  );
  res.status(200).json({ success: true, data });
});

exports.retry = asyncHandler(async (req, res) => {
  const data = await intelligenceService.retryFailedExtraction(
    req.auth.userId,
    req.params.intakeId,
    req.body?.reason
  );
  res.status(200).json({
    success: true,
    message: 'Failed extraction jobs requeued',
    data,
  });
});
