const express = require('express');
const { protect } = require('../../middleware/auth');
const { validate, validateObjectIdParam } = require('../common/validators/validate');
const {
  createProfileSchema,
  updateProfileSchema,
  addExperienceSchema,
  addSkillsSchema,
  updateSkillSchema,
  addProjectSchema,
  updateProjectSchema,
} = require('./candidate.validation');
const candidateController = require('./candidate.controller');

const router = express.Router();

router.use(protect);

// Profile
router.post('/profile', validate(createProfileSchema), candidateController.createProfile);
router.get('/profile', candidateController.getProfile);
router.put('/profile', validate(updateProfileSchema), candidateController.updateProfile);
router.patch('/profile', validate(updateProfileSchema), candidateController.updateProfile);

// Experiences
router.post('/experiences', validate(addExperienceSchema), candidateController.addExperience);
router.delete(
  '/experiences/:experienceId',
  validateObjectIdParam('experienceId'),
  candidateController.deleteExperience
);

// Skills
router.post('/skills', validate(addSkillsSchema), candidateController.addSkills);
router.patch(
  '/skills/:skillId',
  validateObjectIdParam('skillId'),
  validate(updateSkillSchema),
  candidateController.updateSkill
);
router.delete(
  '/skills/:skillId',
  validateObjectIdParam('skillId'),
  candidateController.deleteSkill
);

// Projects
router.post('/projects', validate(addProjectSchema), candidateController.addProject);
router.patch(
  '/projects/:projectId',
  validateObjectIdParam('projectId'),
  validate(updateProjectSchema),
  candidateController.updateProject
);
router.delete(
  '/projects/:projectId',
  validateObjectIdParam('projectId'),
  candidateController.deleteProject
);

module.exports = router;
