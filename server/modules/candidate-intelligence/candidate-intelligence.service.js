const mongoose = require('mongoose');
const AppError = require('../common/errors/AppError');
const { InterviewIntake } = require('../intake/interviewIntake.model');
const analysisRepo = require('./analysis/analysis.repository');
const analysisJobRepo = require('./jobs/analysis-job.repository');
const { enqueueCandidateAnalysis } = require('./analysis/analysis-orchestrator');
const reviewService = require('./candidate-review/candidate-review.service');

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

const requestAnalysis = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  const res = await enqueueCandidateAnalysis(intakeId, { userId });
  return {
    intakeId: String(intakeId),
    reused: res.reused,
    analysisId: res.analysis ? String(res.analysis._id) : null,
    analysisStatus: res.analysis?.analysisStatus || null,
    jobId: res.job ? String(res.job._id) : null,
    jobStatus: res.job?.status || (res.reused ? 'COMPLETED' : 'QUEUED'),
  };
};

const getAnalysisStatus = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  const [analysis, job] = await Promise.all([
    analysisRepo.findLatestAnalysisByIntakeAndUser(intakeId, userId),
    analysisJobRepo.findLatestJobByIntakeAndUser(intakeId, userId),
  ]);

  if (!analysis && !job) {
    return {
      intakeId: String(intakeId),
      analysisId: null,
      status: 'NOT_STARTED',
      processingStage: 'NOT_REQUESTED',
      version: null,
      lastErrorCode: null,
      completedAt: null,
    };
  }

  return {
    intakeId: String(intakeId),
    analysisId: analysis ? String(analysis._id) : null,
    status: analysis?.analysisStatus || job?.status || 'QUEUED',
    processingStage: job?.status || (analysis ? 'COMPLETED' : 'QUEUED'),
    version: analysis?.analysisVersion ?? null,
    lastErrorCode: job?.lastErrorCode || null,
    completedAt: analysis?.completedAt || null,
  };
};

const getCandidateProfile = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  const analysis = await analysisRepo.findLatestAnalysisByIntakeAndUser(intakeId, userId);
  if (!analysis || !analysis.candidateProfileSnapshot) {
    throw new AppError(404, 'Candidate intelligence profile not yet available', 'ANALYSIS_NOT_READY');
  }
  return {
    analysisId: String(analysis._id),
    intakeId: String(intakeId),
    analysisVersion: analysis.analysisVersion,
    analysisStatus: analysis.analysisStatus,
    profile: analysis.reviewedProfileSnapshot || analysis.candidateProfileSnapshot,
  };
};

const getRequirementAssessments = async (userId, intakeId, query = {}) => {
  await verifyOwnedIntake(intakeId, userId);
  const analysis = await analysisRepo.findLatestAnalysisByIntakeAndUser(intakeId, userId);
  if (!analysis) {
    throw new AppError(404, 'Candidate intelligence analysis not found', 'ANALYSIS_NOT_READY');
  }
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));

  const result = await analysisRepo.listRequirementAssessments(analysis._id, userId, {
    page,
    limit,
    requirementType: query.requirementType || null,
    assessment: query.assessment || null,
  });

  return {
    analysisId: String(analysis._id),
    intakeId: String(intakeId),
    analysisVersion: analysis.analysisVersion,
    ...result,
  };
};

const getCompleteAnalysis = async (userId, intakeId) => {
  await verifyOwnedIntake(intakeId, userId);
  const analysis = await analysisRepo.findLatestAnalysisByIntakeAndUser(intakeId, userId);
  if (!analysis) {
    throw new AppError(404, 'Candidate intelligence analysis not found', 'ANALYSIS_NOT_FOUND');
  }
  const { items: requirementAnalysis } = await analysisRepo.listRequirementAssessments(
    analysis._id,
    userId,
    { page: 1, limit: 200 }
  );

  return {
    analysisId: String(analysis._id),
    intakeId: String(intakeId),
    analysisVersion: analysis.analysisVersion,
    schemaVersion: analysis.schemaVersion,
    status: analysis.analysisStatus,
    candidateSummary: analysis.summary?.candidateSummary || null,
    requirementAnalysis,
    experienceAnalysis: analysis.experienceAnalysis,
    strengthsSupportedByEvidence: analysis.summary?.strengthsSupportedByEvidence || [],
    missingInformation: analysis.summary?.missingInformation || [],
    verificationItems: analysis.summary?.verificationItems || [],
    unresolvedInconsistencies: analysis.summary?.unresolvedInconsistencies || [],
    interviewFocusAreas: analysis.interviewFocusAreas || [],
    validationWarnings: analysis.validationWarnings || [],
    sourceVersions: analysis.sourceVersions || {},
    completedAt: analysis.completedAt,
    reviewedCompletedAt: analysis.reviewedCompletedAt,
  };
};

module.exports = {
  requestAnalysis,
  getAnalysisStatus,
  getCandidateProfile,
  getRequirementAssessments,
  getCompleteAnalysis,
  reviewClaim: reviewService.reviewClaim,
  getClaimReviewHistory: reviewService.getClaimReviewHistory,
  completeCandidateReview: reviewService.completeCandidateReview,
};
