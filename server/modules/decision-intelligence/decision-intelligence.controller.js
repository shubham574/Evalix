const asyncHandler = require('../../utils/asyncHandler');
const service = require('./decision-intelligence.service');
const { computeOrganizationCalibration } = require('./calibration/calibration.service');
const {
  recordObjectiveProgress,
  getProgressHistory,
} = require('./development/progress-tracker.service');
const {
  getCandidatePracticeHistory,
  getCandidateCompetencyProgress,
} = require('./coaching/longitudinal-progress.service');

exports.generateLearningInsights = asyncHandler(async (req, res) => {
  const result = await service.enqueueStudentLearningInsightsJob({
    sessionIdOrUuid: req.params.sessionId,
    userId: req.auth.userId,
  });

  res.status(result.deduplicated ? 200 : 202).json({
    success: true,
    data: {
      deduplicated: result.deduplicated,
      reportId: result.report ? String(result.report._id) : null,
      reportVersion: result.report?.reportVersion || null,
      jobId: result.job ? String(result.job._id) : null,
      jobStatus: result.job?.status || 'COMPLETED',
    },
  });
});

exports.getLearningInsights = asyncHandler(async (req, res) => {
  const report = await service.getLatestStudentPracticeReport({
    sessionIdOrUuid: req.params.sessionId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: {
      reportId: String(report._id),
      sessionId: report.sessionUuid,
      reportVersion: report.reportVersion,
      reportStatus: report.reportStatus,
      reviewStateLabel: report.reviewStateLabel,
      practiceSummary: report.practiceSummary,
      strengths: report.strengths,
      developmentAreas: report.developmentAreas,
      questionFeedback: report.questionFeedback,
      competencyInsights: report.competencyInsights,
      preparationCoverage: report.preparationCoverage,
      performancePatterns: report.performancePatterns,
      recommendedNextPractice: report.recommendedNextPractice,
      dataQualityWarnings: report.dataQualityWarnings,
      coachingSummary: report.coachingSummary,
      sourceVersions: report.sourceVersions,
      createdAt: report.createdAt,
    },
  });
});

exports.getAnswerImprovementGuidance = asyncHandler(async (req, res) => {
  const guidance = await service.getAnswerImprovementGuidance({
    sessionIdOrUuid: req.params.sessionId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: guidance,
  });
});

exports.generateDevelopmentPlan = asyncHandler(async (req, res) => {
  const result = await service.enqueueDevelopmentPlanJob({
    sessionIdOrUuid: req.params.sessionId,
    userId: req.auth.userId,
  });

  res.status(result.deduplicated ? 200 : 202).json({
    success: true,
    data: {
      deduplicated: result.deduplicated,
      planId: result.plan ? String(result.plan._id) : null,
      planVersion: result.plan?.planVersion || null,
      jobId: result.job ? String(result.job._id) : null,
      jobStatus: result.job?.status || 'COMPLETED',
    },
  });
});

exports.getDevelopmentPlan = asyncHandler(async (req, res) => {
  const plan = await service.getLatestDevelopmentPlan({
    sessionIdOrUuid: req.params.sessionId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: plan,
  });
});

exports.updateDevelopmentProgress = asyncHandler(async (req, res) => {
  const result = await recordObjectiveProgress({
    planId: req.params.planId,
    userId: req.auth.userId,
    objectiveId: req.params.objectiveId,
    action: req.body.action,
    candidateNotes: req.body.candidateNotes || '',
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

exports.getDevelopmentProgressHistory = asyncHandler(async (req, res) => {
  const result = await getProgressHistory({
    planId: req.params.planId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

exports.getMyPracticeHistory = asyncHandler(async (req, res) => {
  const history = await getCandidatePracticeHistory({
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: history,
  });
});

exports.getMyCompetencyProgress = asyncHandler(async (req, res) => {
  const progress = await getCandidateCompetencyProgress({
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: progress,
  });
});

// Internal-only quality & calibration monitoring (never accessible to students)
exports.getInternalEvaluationQuality = asyncHandler(async (req, res) => {
  const qualityReport = await service.getInternalQualityReport({
    sessionIdOrUuid: req.params.sessionId,
  });

  res.status(200).json({
    success: true,
    data: qualityReport,
  });
});

exports.getInternalCalibration = asyncHandler(async (req, res) => {
  const calibration = await computeOrganizationCalibration({
    organizationId: req.params.organizationId,
  });

  res.status(200).json({
    success: true,
    data: calibration,
  });
});
