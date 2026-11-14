const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const env = require('../../config/env');
const AppError = require('../common/errors/AppError');
const { protect } = require('../../middleware/auth');
const { validate, validateObjectIdParam } = require('../common/validators/validate');
const controller = require('./interview-blueprint.controller');

const generateConfigSchema = z.preprocess(
  (val) => (val && typeof val === 'object' ? val : {}),
  z.object({
    interviewType: z.enum(['TECHNICAL', 'BEHAVIOURAL', 'MIXED', 'ROLE_SPECIFIC']).optional(),
    durationMinutes: z.number().int().min(15).max(120).optional(),
    reason: z.string().trim().max(500).optional(),
  })
);

const regenerateRateLimiter = rateLimit({
  windowMs: env.INTERVIEW_BLUEPRINT_REGENERATE_RATE_WINDOW_MS,
  limit: () => env.INTERVIEW_BLUEPRINT_REGENERATE_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.auth?.userId ? `user:${req.auth.userId}` : rateLimit.ipKeyGenerator(req.ip),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      code: 'BLUEPRINT_REGENERATE_RATE_LIMIT',
      message: 'Too many blueprint regeneration requests. Please try again later.',
    });
  },
});

const requireInternalOrchestrator = (req, _res, next) => {
  const provided = String(req.headers['x-internal-orchestrator-token'] || '');
  const expected = String(env.INTERNAL_ORCHESTRATOR_SECRET || '');
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(
      new AppError(
        403,
        'Internal interview orchestrator authorization required',
        'INTERNAL_ACCESS_FORBIDDEN'
      )
    );
  }
  return next();
};

const internalRouter = express.Router();

// Internal Module 5 orchestrator route (token-protected, never exposed to ordinary candidates)
internalRouter.get(
  '/:intakeId/interview-blueprints/:blueprintId',
  validateObjectIdParam('intakeId'),
  validateObjectIdParam('blueprintId'),
  requireInternalOrchestrator,
  controller.getInternal
);

const router = express.Router();

// Candidate-facing authenticated routes
router.use(protect);

router.post(
  '/:intakeId/interview-blueprints/generate',
  validateObjectIdParam('intakeId'),
  validate(generateConfigSchema),
  controller.generate
);

router.post(
  '/:intakeId/interview-blueprints/regenerate',
  validateObjectIdParam('intakeId'),
  regenerateRateLimiter,
  validate(generateConfigSchema),
  controller.regenerate
);

router.get(
  '/:intakeId/interview-blueprints/status',
  validateObjectIdParam('intakeId'),
  controller.getStatus
);

router.get(
  '/:intakeId/interview-blueprints/current',
  validateObjectIdParam('intakeId'),
  controller.getCurrent
);

router.get(
  '/:intakeId/interview-blueprints/history',
  validateObjectIdParam('intakeId'),
  controller.getHistory
);

router.get(
  '/:intakeId/interview-blueprints/:blueprintId',
  validateObjectIdParam('intakeId'),
  validateObjectIdParam('blueprintId'),
  controller.getById
);

router.get(
  '/:intakeId/interview-blueprints/:blueprintId/questions',
  validateObjectIdParam('intakeId'),
  validateObjectIdParam('blueprintId'),
  controller.getQuestions
);

module.exports = router;
module.exports.internalRouter = internalRouter;
