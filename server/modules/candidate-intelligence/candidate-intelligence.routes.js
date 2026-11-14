const express = require('express');
const { protect } = require('../../middleware/auth');
const { validate, validateObjectIdParam } = require('../common/validators/validate');
const { claimReviewBodySchema } = require('./candidate-review/candidate-review.validation');
const controller = require('./candidate-intelligence.controller');

const router = express.Router();

router.use(protect);

router.post(
  '/:intakeId/candidate-intelligence/analyze',
  validateObjectIdParam('intakeId'),
  controller.analyze
);

router.get(
  '/:intakeId/candidate-intelligence/status',
  validateObjectIdParam('intakeId'),
  controller.getStatus
);

router.get(
  '/:intakeId/candidate-intelligence/profile',
  validateObjectIdParam('intakeId'),
  controller.getProfile
);

router.get(
  '/:intakeId/candidate-intelligence/requirements',
  validateObjectIdParam('intakeId'),
  controller.getRequirements
);

router.get(
  '/:intakeId/candidate-intelligence',
  validateObjectIdParam('intakeId'),
  controller.getComplete
);

router.post(
  '/:intakeId/candidate-intelligence/claims/:claimId/review',
  validateObjectIdParam('intakeId'),
  validate(claimReviewBodySchema),
  controller.reviewClaim
);

router.get(
  '/:intakeId/candidate-intelligence/reviews',
  validateObjectIdParam('intakeId'),
  controller.getReviews
);

router.post(
  '/:intakeId/candidate-intelligence/complete-review',
  validateObjectIdParam('intakeId'),
  controller.completeReview
);

module.exports = router;
