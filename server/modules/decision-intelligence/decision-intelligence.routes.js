const express = require('express');
const { z } = require('zod');
const AppError = require('../common/errors/AppError');
const {
  protect,
  requirePlatformAdmin,
} = require('../../middleware/auth');
const { validate, validateObjectIdParam } = require('../common/validators/validate');
const controller = require('./decision-intelligence.controller');
const { PROGRESS_ACTIONS } = require('./development/developmentProgressEvent.model');

const progressUpdateSchema = z.object({
  action: z.enum(PROGRESS_ACTIONS),
  candidateNotes: z.string().trim().max(1000).optional(),
});

// 1. Student session-scoped coaching & development plan routes (/api/v1/interview-sessions)
const sessionDecisionRouter = express.Router();
sessionDecisionRouter.use(protect);

sessionDecisionRouter.post(
  '/:sessionId/learning-insights/generate',
  controller.generateLearningInsights
);
sessionDecisionRouter.get(
  '/:sessionId/learning-insights',
  controller.getLearningInsights
);
sessionDecisionRouter.get(
  '/:sessionId/learning-insights/answers',
  controller.getAnswerImprovementGuidance
);
sessionDecisionRouter.post(
  '/:sessionId/development-plan/generate',
  controller.generateDevelopmentPlan
);
sessionDecisionRouter.get(
  '/:sessionId/development-plan',
  controller.getDevelopmentPlan
);

// 2. Student longitudinal progress routes (/api/v1/candidates)
const candidateProgressRouter = express.Router();
candidateProgressRouter.use(protect);

candidateProgressRouter.get(
  '/me/practice-history',
  controller.getMyPracticeHistory
);
candidateProgressRouter.get(
  '/me/competency-progress',
  controller.getMyCompetencyProgress
);

// 3. Development plan objective progress routes (/api/v1/development-plans)
const developmentPlanRouter = express.Router();
developmentPlanRouter.use(protect);
developmentPlanRouter.post(
  '/:planId/objectives/:objectiveId/progress',
  validateObjectIdParam('planId'),
  validate(progressUpdateSchema),
  controller.updateDevelopmentProgress
);
developmentPlanRouter.get(
  '/:planId/progress',
  validateObjectIdParam('planId'),
  controller.getDevelopmentProgressHistory
);

// 4. Internal platform evaluation-quality & calibration monitoring (/api/v1/internal)
// Strictly requires Platform Admin or timing-safe internal service token.
// Recruiter roles and student accounts are both rejected with 403.
const internalQualityRouter = express.Router();
internalQualityRouter.use(requirePlatformAdmin);

const enforceInternalOrgBoundary = (req, _res, next) => {
  if (req.internalServiceAuth?.isPlatformAdmin) return next();
  if (req.auth?.orgId && req.auth.orgId !== req.params.organizationId) {
    return next(
      new AppError(403, 'Cross-organization internal access is forbidden', 'ORGANIZATION_FORBIDDEN')
    );
  }
  return next();
};

internalQualityRouter.get(
  '/evaluation-quality/sessions/:sessionId',
  controller.getInternalEvaluationQuality
);
internalQualityRouter.get(
  '/evaluation-calibration/:organizationId',
  enforceInternalOrgBoundary,
  controller.getInternalCalibration
);

module.exports = {
  sessionDecisionRouter,
  candidateProgressRouter,
  developmentPlanRouter,
  internalQualityRouter,
};
