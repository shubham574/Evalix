const express = require('express');
const { protect } = require('../../middleware/auth');
const { validate, validateObjectIdParam } = require('../common/validators/validate');
const { createDocumentUploadMiddleware } = require('../documents/uploadMiddleware');
const {
  createIntakeSchema,
  updateIntakeSchema,
  listIntakesQuerySchema,
} = require('./intake.validation');
const intakeController = require('./intake.controller');

const router = express.Router();

router.use(protect);

router.post('/', validate(createIntakeSchema), intakeController.createIntake);
router.get('/', validate(listIntakesQuerySchema, 'query'), intakeController.listIntakes);

router.get('/:intakeId', validateObjectIdParam('intakeId'), intakeController.getIntake);
router.patch(
  '/:intakeId',
  validateObjectIdParam('intakeId'),
  validate(updateIntakeSchema),
  intakeController.updateIntake
);
router.post(
  '/:intakeId/revisions',
  validateObjectIdParam('intakeId'),
  intakeController.createRevision
);

router.post(
  '/:intakeId/resume',
  validateObjectIdParam('intakeId'),
  createDocumentUploadMiddleware('resume'),
  intakeController.uploadResume
);

router.post(
  '/:intakeId/job-description',
  validateObjectIdParam('intakeId'),
  createDocumentUploadMiddleware('jobDescription'),
  intakeController.uploadJobDescription
);

router.post(
  '/:intakeId/submit',
  validateObjectIdParam('intakeId'),
  intakeController.submitIntake
);

module.exports = router;
