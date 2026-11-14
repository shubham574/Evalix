const express = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../../config/env');
const { protect } = require('../../middleware/auth');
const { validateObjectIdParam } = require('../common/validators/validate');
const controller = require('./document-intelligence.controller');

const createManualRetryRateLimiter = () =>
  rateLimit({
    windowMs: env.DOCUMENT_EXTRACTION_MANUAL_RETRY_RATE_WINDOW_MS,
    limit: () => env.DOCUMENT_EXTRACTION_MANUAL_RETRY_RATE_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) =>
      req.auth?.userId ? `user:${req.auth.userId}` : rateLimit.ipKeyGenerator(req.ip),
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        code: 'RETRY_RATE_LIMIT_EXCEEDED',
        message: 'Too many manual extraction retry requests. Please try again later.',
      });
    },
  });

const manualRetryLimiter = createManualRetryRateLimiter();

const router = express.Router();

router.use(protect);

router.get(
  '/:intakeId/intelligence/status',
  validateObjectIdParam('intakeId'),
  controller.getStatus
);

router.get(
  '/:intakeId/intelligence/resume',
  validateObjectIdParam('intakeId'),
  controller.getResume
);

router.get(
  '/:intakeId/intelligence/job-description',
  validateObjectIdParam('intakeId'),
  controller.getJobDescription
);

router.get(
  '/:intakeId/intelligence',
  validateObjectIdParam('intakeId'),
  controller.getComplete
);

router.post(
  '/:intakeId/intelligence/retry',
  validateObjectIdParam('intakeId'),
  manualRetryLimiter,
  controller.retry
);

module.exports = router;
module.exports.createManualRetryRateLimiter = createManualRetryRateLimiter;
