const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const env = require('../../config/env');
const AppError = require('../common/errors/AppError');
const { protect } = require('../../middleware/auth');
const { validate, validateObjectIdParam } = require('../common/validators/validate');
const controller = require('./interview-evaluation.controller');

const retryRateLimiter = rateLimit({
  windowMs: env.INTERVIEW_EVALUATION_RETRY_RATE_WINDOW_MS,
  limit: () => env.INTERVIEW_EVALUATION_RETRY_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.auth?.userId ? `user:${req.auth.userId}` : rateLimit.ipKeyGenerator(req.ip),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      code: 'EVALUATION_RETRY_RATE_LIMIT',
      message: 'Too many evaluation retry requests. Please try again later.',
    });
  },
});

const requireRecruiterOrReviewer = (req, _res, next) => {
  if (!controller.isRecruiterRequest(req)) {
    return next(
      new AppError(
        403,
        'Recruiter or authorised reviewer permissions required',
        'REVIEWER_FORBIDDEN'
      )
    );
  }
  return next();
};

const retrySchema = z.object({
  retryReason: z.string().trim().min(3).max(500),
});

const reviewSchema = z.object({
  targetType: z.enum(['RUN', 'QUESTION', 'COMPETENCY', 'REPORT']),
  targetId: z.string().trim().min(1).max(120),
  reviewAction: z.enum([
    'ACCEPT',
    'REQUEST_REVIEW',
    'ADJUST_SCORE',
    'FLAG_INVALID',
    'APPROVE_REPORT',
  ]),
  revisedScore: z.number().min(1).max(5).nullable().optional(),
  justification: z.string().trim().min(3).max(1000),
});

// 1. Session-scoped evaluation & reporting routes (/api/v1/interview-sessions)
const sessionEvaluationRouter = express.Router();
sessionEvaluationRouter.use(protect);
sessionEvaluationRouter.post('/:sessionId/evaluation', controller.requestEvaluation);
sessionEvaluationRouter.get('/:sessionId/evaluation/status', controller.getEvaluationStatus);
sessionEvaluationRouter.get('/:sessionId/evaluation/questions', controller.getQuestionEvaluations);
sessionEvaluationRouter.get(
  '/:sessionId/evaluation/competencies',
  controller.getCompetencyEvaluations
);
sessionEvaluationRouter.get('/:sessionId/evaluation', controller.getOverallEvaluation);
sessionEvaluationRouter.get('/:sessionId/report', controller.getInterviewReport);
sessionEvaluationRouter.get('/:sessionId/report/history', controller.getReportHistory);
sessionEvaluationRouter.post(
  '/:sessionId/evaluation/retry',
  requireRecruiterOrReviewer,
  retryRateLimiter,
  validate(retrySchema),
  controller.retryEvaluation
);

// 2. Evaluation review routes (/api/v1/interview-evaluations)
const reviewEvaluationRouter = express.Router();
reviewEvaluationRouter.use(protect);
reviewEvaluationRouter.use(requireRecruiterOrReviewer);
reviewEvaluationRouter.post(
  '/:evaluationId/reviews',
  validateObjectIdParam('evaluationId'),
  validate(reviewSchema),
  controller.submitReview
);
reviewEvaluationRouter.get(
  '/:evaluationId/reviews',
  validateObjectIdParam('evaluationId'),
  controller.getReviewHistory
);

module.exports = {
  sessionEvaluationRouter,
  reviewEvaluationRouter,
  requireRecruiterOrReviewer,
};
