const crypto = require('crypto');
const asyncHandler = require('../../utils/asyncHandler');
const env = require('../../config/env');
const service = require('./interview-evaluation.service');
const {
  toCandidateReportDto,
  toRecruiterReportDto,
  toCandidateQuestionDto,
  toRecruiterQuestionDto,
} = require('./reporting/report.serializer');

const { hasRecruiterAuthority } = require('../../middleware/auth');

const isRecruiterRequest = (req) => {
  const provided = String(req.headers['x-internal-orchestrator-token'] || '');
  const expected = String(env.INTERNAL_ORCHESTRATOR_SECRET || '');
  if (expected && provided) {
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  if (hasRecruiterAuthority(req.auth)) {
    return true;
  }
  const roleHeader = String(req.headers['x-user-role'] || '').toUpperCase();
  if (
    process.env.NODE_ENV !== 'production' &&
    req.auth?.isTestAuth === true &&
    (roleHeader === 'RECRUITER' || roleHeader === 'REVIEWER' || roleHeader === 'ADMIN')
  ) {
    return true;
  }
  return false;
};

exports.isRecruiterRequest = isRecruiterRequest;

exports.requestEvaluation = asyncHandler(async (req, res) => {
  const isRecruiter = isRecruiterRequest(req);
  const { run, job, deduplicated } = await service.createEvaluationRunAndJob({
    sessionIdOrUuid: req.params.sessionId,
    userId: req.auth.userId,
    isRecruiter,
  });

  res.status(deduplicated ? 200 : 202).json({
    success: true,
    data: {
      evaluationRunId: String(run._id),
      evaluationVersion: run.evaluationVersion,
      status: run.status,
      jobStatus: job?.status || 'QUEUED',
      deduplicated,
    },
  });
});

exports.getEvaluationStatus = asyncHandler(async (req, res) => {
  const isRecruiter = isRecruiterRequest(req);
  const statusData = await service.getEvaluationStatus(req.params.sessionId, {
    userId: req.auth.userId,
    isRecruiter,
  });

  res.status(200).json({
    success: true,
    data: statusData,
  });
});

exports.getQuestionEvaluations = asyncHandler(async (req, res) => {
  const isRecruiter = isRecruiterRequest(req);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const { run, items, total } = await service.getQuestionEvaluations(
    req.params.sessionId,
    { userId: req.auth.userId, isRecruiter },
    { page, limit }
  );

  res.status(200).json({
    success: true,
    data: {
      evaluationRunId: String(run._id),
      evaluationVersion: run.evaluationVersion,
      pagination: { page, limit, total },
      questions: items.map(isRecruiter ? toRecruiterQuestionDto : toCandidateQuestionDto),
    },
  });
});

exports.getCompetencyEvaluations = asyncHandler(async (req, res) => {
  const isRecruiter = isRecruiterRequest(req);
  const { run, items } = await service.getCompetencyEvaluations(
    req.params.sessionId,
    { userId: req.auth.userId, isRecruiter }
  );

  const competencies = isRecruiter
    ? items
    : items
        .filter((c) => c.assessmentStatus !== 'NOT_ASSESSED')
        .map((c) => ({
          competencyId: c.competencyId,
          competencyName: c.competencyName,
          assessmentStatus: c.assessmentStatus,
          ...(env.INTERVIEW_EVALUATION_EXPOSE_CANDIDATE_SCORES && c.score !== null
            ? { score: c.score, scoreScale: c.scoreScale }
            : {}),
          strengths: c.strengths,
          developmentAreas: c.developmentAreas,
        }));

  res.status(200).json({
    success: true,
    data: {
      evaluationRunId: String(run._id),
      evaluationVersion: run.evaluationVersion,
      competencies,
    },
  });
});

exports.getOverallEvaluation = asyncHandler(async (req, res) => {
  const isRecruiter = isRecruiterRequest(req);
  const { run } = await service.getLatestRunForSession(req.params.sessionId, {
    userId: req.auth.userId,
    isRecruiter,
  });

  const summary =
    isRecruiter || env.INTERVIEW_EVALUATION_EXPOSE_CANDIDATE_SCORES
      ? run.evaluationSummary
      : {
          overallStatus: run.evaluationSummary?.overallStatus || run.status,
          advisoryOnly: true,
        };

  res.status(200).json({
    success: true,
    data: {
      evaluationRunId: String(run._id),
      evaluationVersion: run.evaluationVersion,
      status: run.status,
      reviewStatus: run.reviewStatus,
      evaluationSummary: summary,
      coverageSummary: run.coverageSummary,
    },
  });
});

exports.getInterviewReport = asyncHandler(async (req, res) => {
  const isRecruiter = isRecruiterRequest(req);
  const { run, report } = await service.getInterviewReport(req.params.sessionId, {
    userId: req.auth.userId,
    isRecruiter,
  });

  res.status(200).json({
    success: true,
    data: isRecruiter
      ? toRecruiterReportDto(report, run)
      : toCandidateReportDto(report, run),
  });
});

exports.getReportHistory = asyncHandler(async (req, res) => {
  const isRecruiter = isRecruiterRequest(req);
  const { runs, reports } = await service.getReportHistory(req.params.sessionId, {
    userId: req.auth.userId,
    isRecruiter,
  });

  const runById = new Map(runs.map((r) => [String(r._id), r]));
  res.status(200).json({
    success: true,
    data: {
      versions: reports.map((rep) => {
        const r = runById.get(String(rep.evaluationRunId));
        return isRecruiter
          ? toRecruiterReportDto(rep, r)
          : toCandidateReportDto(rep, r);
      }),
    },
  });
});

exports.retryEvaluation = asyncHandler(async (req, res) => {
  const { run, job } = await service.createEvaluationRunAndJob({
    sessionIdOrUuid: req.params.sessionId,
    userId: req.auth.userId,
    isRecruiter: true,
    retryReason: req.body.retryReason,
    forceNewVersion: true,
  });

  res.status(202).json({
    success: true,
    data: {
      evaluationRunId: String(run._id),
      evaluationVersion: run.evaluationVersion,
      status: run.status,
      jobStatus: job?.status || 'QUEUED',
      retryReason: run.retryReason,
    },
  });
});

exports.submitReview = asyncHandler(async (req, res) => {
  const { run, reviewEvent } = await service.submitHumanReview({
    evaluationId: req.params.evaluationId,
    reviewerId: req.auth.userId,
    targetType: req.body.targetType,
    targetId: req.body.targetId,
    reviewAction: req.body.reviewAction,
    revisedScore: req.body.revisedScore ?? null,
    justification: req.body.justification,
  });

  res.status(201).json({
    success: true,
    data: {
      evaluationRunId: String(run._id),
      reviewStatus: run.reviewStatus,
      latestReviewVersion: run.latestReviewVersion,
      reviewEvent,
    },
  });
});

exports.getReviewHistory = asyncHandler(async (req, res) => {
  const { run, events } = await service.getHumanReviewHistory({
    evaluationId: req.params.evaluationId,
  });

  res.status(200).json({
    success: true,
    data: {
      evaluationRunId: String(run._id),
      reviewStatus: run.reviewStatus,
      reviews: events,
    },
  });
});
