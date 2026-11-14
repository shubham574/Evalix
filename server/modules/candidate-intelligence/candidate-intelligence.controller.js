const asyncHandler = require('../../utils/asyncHandler');
const service = require('./candidate-intelligence.service');

exports.analyze = asyncHandler(async (req, res) => {
  const data = await service.requestAnalysis(req.auth.userId, req.params.intakeId);
  res.status(data.reused ? 200 : 202).json({ success: true, data });
});

exports.getStatus = asyncHandler(async (req, res) => {
  const data = await service.getAnalysisStatus(req.auth.userId, req.params.intakeId);
  res.status(200).json({ success: true, data });
});

exports.getProfile = asyncHandler(async (req, res) => {
  const data = await service.getCandidateProfile(req.auth.userId, req.params.intakeId);
  res.status(200).json({ success: true, data });
});

exports.getRequirements = asyncHandler(async (req, res) => {
  const data = await service.getRequirementAssessments(
    req.auth.userId,
    req.params.intakeId,
    req.query
  );
  res.status(200).json({ success: true, data });
});

exports.getComplete = asyncHandler(async (req, res) => {
  const data = await service.getCompleteAnalysis(req.auth.userId, req.params.intakeId);
  res.status(200).json({ success: true, data });
});

exports.reviewClaim = asyncHandler(async (req, res) => {
  const data = await service.reviewClaim(
    req.auth.userId,
    req.params.intakeId,
    req.params.claimId,
    req.body
  );
  res.status(201).json({ success: true, data });
});

exports.getReviews = asyncHandler(async (req, res) => {
  const data = await service.getClaimReviewHistory(req.auth.userId, req.params.intakeId);
  res.status(200).json({ success: true, data });
});

exports.completeReview = asyncHandler(async (req, res) => {
  const data = await service.completeCandidateReview(req.auth.userId, req.params.intakeId);
  res.status(200).json({
    success: true,
    data: {
      analysisId: String(data._id),
      intakeId: String(data.intakeId),
      analysisStatus: data.analysisStatus,
      reviewedCompletedAt: data.reviewedCompletedAt,
    },
  });
});
