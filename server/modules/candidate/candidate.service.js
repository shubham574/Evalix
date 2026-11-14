const AppError = require('../common/errors/AppError');
const candidateRepo = require('./candidate.repository');
const documentRepo = require('../documents/document.repository');
const { toPublicDocumentDTO } = require('../documents/document.service');

const toProfileDTO = (profile) => ({
  id: String(profile._id),
  userId: profile.userId,
  fullName: profile.fullName,
  email: profile.email,
  phone: profile.phone,
  currentJobTitle: profile.currentJobTitle,
  totalExperienceMonths: profile.totalExperienceMonths,
  experienceLevel: profile.experienceLevel,
  professionalSummary: profile.professionalSummary,
  version: profile.version,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});

const requireCandidateProfile = async (userId, session = null) => {
  const profile = await candidateRepo.findProfileByUserId(userId, session);
  if (!profile) {
    throw new AppError(
      404,
      'Candidate profile not found. Please create your profile first.',
      'CANDIDATE_PROFILE_NOT_FOUND'
    );
  }
  return profile;
};

const createCandidateProfile = async (userId, payload) => {
  const existing = await candidateRepo.findProfileByUserId(userId);
  if (existing) {
    throw new AppError(
      409,
      'Candidate profile already exists for this account',
      'PROFILE_ALREADY_EXISTS'
    );
  }

  try {
    const created = await candidateRepo.createProfile({
      userId,
      ...payload,
    });
    return toProfileDTO(created);
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError(
        409,
        'Candidate profile already exists for this account',
        'PROFILE_ALREADY_EXISTS'
      );
    }
    throw err;
  }
};

const getFullCandidateProfile = async (userId) => {
  const profile = await requireCandidateProfile(userId);
  const candidateProfileId = profile._id;

  // Parallel relation loading — avoids N+1 queries and strips internal storage keys
  const [experiences, skills, projects, documentsPage] = await Promise.all([
    candidateRepo.listExperiences(candidateProfileId),
    candidateRepo.listSkills(candidateProfileId),
    candidateRepo.listProjects(candidateProfileId),
    documentRepo.listByCandidateProfile(candidateProfileId, { page: 1, limit: 50 }),
  ]);

  return {
    profile: toProfileDTO(profile),
    experiences: experiences.map((e) => ({
      id: String(e._id),
      companyName: e.companyName,
      jobTitle: e.jobTitle,
      employmentType: e.employmentType,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      description: e.description,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    skills: skills.map((s) => ({
      id: String(s._id),
      skillName: s.skillName,
      skillCategory: s.skillCategory,
      selfReportedProficiency: s.selfReportedProficiency,
      createdAt: s.createdAt,
    })),
    projects: projects.map((p) => ({
      id: String(p._id),
      projectTitle: p.projectTitle,
      projectDescription: p.projectDescription,
      technologies: p.technologies,
      projectUrl: p.projectUrl,
      candidateResponsibility: p.candidateResponsibility,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    documents: documentsPage.items.map(toPublicDocumentDTO),
  };
};

const updateCandidateProfile = async (userId, payload) => {
  const { expectedVersion, ...updates } = payload;

  const existing = await requireCandidateProfile(userId);
  const updated = await candidateRepo.updateProfileByUserId(userId, updates, expectedVersion);

  if (!updated) {
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new AppError(
        409,
        'Profile was modified concurrently. Please refresh and retry.',
        'CONCURRENT_MODIFICATION'
      );
    }
    throw new AppError(404, 'Candidate profile not found', 'CANDIDATE_PROFILE_NOT_FOUND');
  }

  return toProfileDTO(updated);
};

const addCandidateExperience = async (userId, payload) => {
  const profile = await requireCandidateProfile(userId);
  const created = await candidateRepo.createExperience({
    candidateProfileId: profile._id,
    userId,
    ...payload,
  });

  return {
    id: String(created._id),
    candidateProfileId: String(created.candidateProfileId),
    companyName: created.companyName,
    jobTitle: created.jobTitle,
    employmentType: created.employmentType,
    startDate: created.startDate,
    endDate: created.endDate,
    isCurrent: created.isCurrent,
    description: created.description,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
};

const deleteCandidateExperience = async (userId, experienceId) => {
  const deleted = await candidateRepo.deleteExperienceByIdAndUser(experienceId, userId);
  if (!deleted) {
    throw new AppError(404, 'Experience record not found', 'EXPERIENCE_NOT_FOUND');
  }
  return { deleted: true, experienceId: String(deleted._id) };
};

const addCandidateSkills = async (userId, payload) => {
  const profile = await requireCandidateProfile(userId);
  const items = Array.isArray(payload.skills) ? payload.skills : [payload];
  const skills = await candidateRepo.upsertSkillsBulk(profile._id, userId, items);

  return skills.map((s) => ({
    id: String(s._id),
    skillName: s.skillName,
    skillCategory: s.skillCategory,
    selfReportedProficiency: s.selfReportedProficiency,
    createdAt: s.createdAt,
  }));
};

const updateCandidateSkill = async (userId, skillId, updates) => {
  const updated = await candidateRepo.updateSkillByIdAndUser(skillId, userId, updates);
  if (!updated) {
    throw new AppError(404, 'Skill not found', 'SKILL_NOT_FOUND');
  }
  return {
    id: String(updated._id),
    skillName: updated.skillName,
    skillCategory: updated.skillCategory,
    selfReportedProficiency: updated.selfReportedProficiency,
    createdAt: updated.createdAt,
  };
};

const deleteCandidateSkill = async (userId, skillId) => {
  const deleted = await candidateRepo.deleteSkillByIdAndUser(skillId, userId);
  if (!deleted) {
    throw new AppError(404, 'Skill not found', 'SKILL_NOT_FOUND');
  }
  return { deleted: true, skillId: String(deleted._id) };
};

const addCandidateProject = async (userId, payload) => {
  const profile = await requireCandidateProfile(userId);
  const created = await candidateRepo.createProject({
    candidateProfileId: profile._id,
    userId,
    ...payload,
  });
  return {
    id: String(created._id),
    candidateProfileId: String(created.candidateProfileId),
    projectTitle: created.projectTitle,
    projectDescription: created.projectDescription,
    technologies: created.technologies,
    projectUrl: created.projectUrl,
    candidateResponsibility: created.candidateResponsibility,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
};

const updateCandidateProject = async (userId, projectId, updates) => {
  const updated = await candidateRepo.updateProjectByIdAndUser(projectId, userId, updates);
  if (!updated) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  return {
    id: String(updated._id),
    projectTitle: updated.projectTitle,
    projectDescription: updated.projectDescription,
    technologies: updated.technologies,
    projectUrl: updated.projectUrl,
    candidateResponsibility: updated.candidateResponsibility,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
};

const deleteCandidateProject = async (userId, projectId) => {
  const deleted = await candidateRepo.deleteProjectByIdAndUser(projectId, userId);
  if (!deleted) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  return { deleted: true, projectId: String(deleted._id) };
};

module.exports = {
  requireCandidateProfile,
  createCandidateProfile,
  getFullCandidateProfile,
  updateCandidateProfile,
  addCandidateExperience,
  deleteCandidateExperience,
  addCandidateSkills,
  updateCandidateSkill,
  deleteCandidateSkill,
  addCandidateProject,
  updateCandidateProject,
  deleteCandidateProject,
};
