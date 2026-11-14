const asyncHandler = require('../../utils/asyncHandler');
const candidateService = require('./candidate.service');

exports.createProfile = asyncHandler(async (req, res) => {
  const data = await candidateService.createCandidateProfile(req.auth.userId, req.body);
  res.status(201).json({
    success: true,
    message: 'Candidate profile created successfully',
    data,
  });
});

exports.getProfile = asyncHandler(async (req, res) => {
  const data = await candidateService.getFullCandidateProfile(req.auth.userId);
  res.status(200).json({
    success: true,
    message: 'Candidate profile retrieved successfully',
    data,
  });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const data = await candidateService.updateCandidateProfile(req.auth.userId, req.body);
  res.status(200).json({
    success: true,
    message: 'Candidate profile updated successfully',
    data,
  });
});

exports.addExperience = asyncHandler(async (req, res) => {
  const data = await candidateService.addCandidateExperience(req.auth.userId, req.body);
  res.status(201).json({
    success: true,
    message: 'Professional experience added successfully',
    data,
  });
});

exports.deleteExperience = asyncHandler(async (req, res) => {
  const data = await candidateService.deleteCandidateExperience(
    req.auth.userId,
    req.params.experienceId
  );
  res.status(200).json({
    success: true,
    message: 'Professional experience deleted successfully',
    data,
  });
});

exports.addSkills = asyncHandler(async (req, res) => {
  const data = await candidateService.addCandidateSkills(req.auth.userId, req.body);
  res.status(201).json({
    success: true,
    message: 'Candidate skills saved successfully',
    data,
  });
});

exports.updateSkill = asyncHandler(async (req, res) => {
  const data = await candidateService.updateCandidateSkill(
    req.auth.userId,
    req.params.skillId,
    req.body
  );
  res.status(200).json({
    success: true,
    message: 'Candidate skill updated successfully',
    data,
  });
});

exports.deleteSkill = asyncHandler(async (req, res) => {
  const data = await candidateService.deleteCandidateSkill(req.auth.userId, req.params.skillId);
  res.status(200).json({
    success: true,
    message: 'Candidate skill deleted successfully',
    data,
  });
});

exports.addProject = asyncHandler(async (req, res) => {
  const data = await candidateService.addCandidateProject(req.auth.userId, req.body);
  res.status(201).json({
    success: true,
    message: 'Candidate project added successfully',
    data,
  });
});

exports.updateProject = asyncHandler(async (req, res) => {
  const data = await candidateService.updateCandidateProject(
    req.auth.userId,
    req.params.projectId,
    req.body
  );
  res.status(200).json({
    success: true,
    message: 'Candidate project updated successfully',
    data,
  });
});

exports.deleteProject = asyncHandler(async (req, res) => {
  const data = await candidateService.deleteCandidateProject(req.auth.userId, req.params.projectId);
  res.status(200).json({
    success: true,
    message: 'Candidate project deleted successfully',
    data,
  });
});
