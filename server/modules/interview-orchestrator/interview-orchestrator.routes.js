const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const env = require('../../config/env');
const AppError = require('../common/errors/AppError');
const { protect } = require('../../middleware/auth');
const { validate, validateObjectIdParam } = require('../common/validators/validate');
const controller = require('./interview-orchestrator.controller');

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const turnRateLimiter = rateLimit({
  windowMs: env.INTERVIEW_ORCHESTRATOR_TURN_RATE_WINDOW_MS,
  limit: () => env.INTERVIEW_ORCHESTRATOR_TURN_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.auth?.userId ? `user:${req.auth.userId}` : rateLimit.ipKeyGenerator(req.ip),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      code: 'INTERVIEW_TURN_RATE_LIMIT',
      message: 'Too many interview turn requests. Please slow down.',
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
        'INTERNAL_ORCHESTRATOR_FORBIDDEN'
      )
    );
  }
  return next();
};

const optionalObject = (shape) =>
  z.preprocess((val) => (val && typeof val === 'object' ? val : {}), z.object(shape));

const createSessionSchema = optionalObject({
  blueprintId: z.string().trim().min(1).optional(),
  practiceMode: z.enum(['REALISTIC_MOCK', 'GUIDED_PRACTICE', 'FOCUSED_SKILL_PRACTICE']).optional(),
  competencyId: z.string().trim().min(1).optional(),
  maxQuestions: z.number().int().min(1).max(20).optional(),
});

const hintSchema = z.object({
  questionId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(1),
});

const attemptSchema = z.object({
  questionId: z.string().trim().min(1).optional(),
  answerText: z.string().trim().max(15000).optional(),
  transcriptText: z.string().trim().max(15000).optional(),
  transcriptStatus: z.enum(['PARTIAL', 'FINAL']).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  idempotencyKey: z.string().trim().min(1),
});

const retrySchema = optionalObject({
  questionId: z.string().trim().min(1).optional(),
});

const continueSchema = optionalObject({
  idempotencyKey: z.string().trim().min(1).optional(),
});

const startSessionSchema = optionalObject({
  consentGranted: z.boolean().optional(),
});

const pauseSessionSchema = optionalObject({
  reason: z.string().trim().max(200).optional(),
});

const endSessionSchema = optionalObject({
  reason: z.string().trim().max(200).optional(),
  abandon: z.boolean().optional(),
});

const submitTurnSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(200),
  transcriptText: z.string().max(8000).optional(),
  transcriptStatus: z.enum(['PARTIAL', 'FINAL', 'CONFIRMED']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  expectedStateVersion: z.number().int().min(0).optional(),
});

const interruptSchema = optionalObject({
  turnNumber: z.number().int().min(1).optional(),
  interruptedAtMs: z.number().int().min(0).optional(),
  reason: z.string().trim().max(200).optional(),
});

// 1. Intake-scoped session creation
const intakeSessionRouter = express.Router();
intakeSessionRouter.use(protect);
intakeSessionRouter.post(
  '/:intakeId/interview-sessions',
  validateObjectIdParam('intakeId'),
  validate(createSessionSchema),
  controller.createSession
);

// 2. Candidate session lifecycle & live turn endpoints
const candidateSessionRouter = express.Router();
candidateSessionRouter.use(protect);
candidateSessionRouter.post(
  '/:sessionId/start',
  validate(startSessionSchema),
  controller.startSession
);
candidateSessionRouter.post(
  '/:sessionId/pause',
  validate(pauseSessionSchema),
  controller.pauseSession
);
candidateSessionRouter.post('/:sessionId/resume', controller.resumeSession);
candidateSessionRouter.post(
  '/:sessionId/end',
  validate(endSessionSchema),
  controller.endSession
);
candidateSessionRouter.post(
  '/:sessionId/turns',
  turnRateLimiter,
  uploadAudio.single('audio'),
  validate(submitTurnSchema),
  controller.submitCandidateTurn
);
candidateSessionRouter.post(
  '/:sessionId/interrupt',
  validate(interruptSchema),
  controller.interruptSession
);
candidateSessionRouter.post(
  '/:sessionId/hint',
  validate(hintSchema),
  controller.requestHint
);
candidateSessionRouter.post(
  '/:sessionId/attempts',
  turnRateLimiter,
  uploadAudio.single('audio'),
  validate(attemptSchema),
  controller.submitPracticeAttempt
);
candidateSessionRouter.get('/:sessionId/feedback', controller.getPracticeFeedback);
candidateSessionRouter.post(
  '/:sessionId/retry',
  validate(retrySchema),
  controller.preparePracticeRetry
);
candidateSessionRouter.post(
  '/:sessionId/continue',
  validate(continueSchema),
  controller.continuePracticeQuestion
);
candidateSessionRouter.get('/:sessionId', controller.getSession);
candidateSessionRouter.get('/:sessionId/transcript', controller.getTranscript);
candidateSessionRouter.get('/:sessionId/progress', controller.getProgress);

// 3. Internal Orchestrator / Module 6 endpoints
const internalSessionRouter = express.Router();
internalSessionRouter.use(requireInternalOrchestrator);
internalSessionRouter.post(
  '/:sessionId/turns',
  uploadAudio.single('audio'),
  validate(submitTurnSchema),
  controller.internalSubmitTurn
);
internalSessionRouter.get('/:sessionId/context', controller.internalGetContext);
internalSessionRouter.post(
  '/:sessionId/complete',
  validate(endSessionSchema),
  controller.internalCompleteSession
);
internalSessionRouter.post(
  '/:sessionId/interrupt',
  validate(interruptSchema),
  controller.internalInterruptSession
);
internalSessionRouter.post(
  '/:sessionId/turns/:turnId/retry-tts',
  controller.internalRetryTurnTts
);

module.exports = {
  intakeSessionRouter,
  candidateSessionRouter,
  internalSessionRouter,
  requireInternalOrchestrator,
};
