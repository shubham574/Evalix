const { CandidateProfile } = require('./candidateProfile.model');
const { CandidateExperience } = require('./candidateExperience.model');
const { CandidateSkill } = require('./candidateSkill.model');
const { CandidateProject } = require('./candidateProject.model');

const findProfileByUserId = async (userId, session = null) => {
  const query = CandidateProfile.findOne({ userId });
  if (session) query.session(session);
  return query.exec();
};

const createProfile = async (data, session = null) => {
  const [profile] = await CandidateProfile.create([data], session ? { session } : {});
  return profile;
};

const updateProfileByUserId = async (userId, updates, expectedVersion = null, session = null) => {
  const filter = { userId };
  if (expectedVersion !== null && expectedVersion !== undefined) {
    filter.version = expectedVersion;
  }

  return CandidateProfile.findOneAndUpdate(
    filter,
    {
      $set: updates,
      $inc: { version: 1 },
    },
    {
      new: true,
      runValidators: true,
      ...(session ? { session } : {}),
    }
  );
};

const listExperiences = async (candidateProfileId) =>
  CandidateExperience.find({ candidateProfileId }).sort({ isCurrent: -1, startDate: -1 }).lean();

const createExperience = async (data, session = null) => {
  const [exp] = await CandidateExperience.create([data], session ? { session } : {});
  return exp;
};

const deleteExperienceByIdAndUser = async (experienceId, userId) =>
  CandidateExperience.findOneAndDelete({ _id: experienceId, userId });

const listSkills = async (candidateProfileId) =>
  CandidateSkill.find({ candidateProfileId }).sort({ createdAt: 1 }).lean();

const upsertSkillsBulk = async (candidateProfileId, userId, items) => {
  const ops = items.map((item) => {
    const normalized = item.skillName.trim().toLowerCase();
    return {
      updateOne: {
        filter: { candidateProfileId, normalizedSkillName: normalized },
        update: {
          $set: {
            skillName: item.skillName.trim(),
            normalizedSkillName: normalized,
            skillCategory: item.skillCategory || 'OTHER',
            selfReportedProficiency: item.selfReportedProficiency || 'INTERMEDIATE',
            userId,
          },
        },
        upsert: true,
      },
    };
  });

  await CandidateSkill.bulkWrite(ops, { ordered: false });
  return listSkills(candidateProfileId);
};

const updateSkillByIdAndUser = async (skillId, userId, updates) => {
  const setFields = { ...updates };
  if (updates.skillName) {
    setFields.normalizedSkillName = updates.skillName.trim().toLowerCase();
  }
  return CandidateSkill.findOneAndUpdate(
    { _id: skillId, userId },
    { $set: setFields },
    { new: true, runValidators: true }
  );
};

const deleteSkillByIdAndUser = async (skillId, userId) =>
  CandidateSkill.findOneAndDelete({ _id: skillId, userId });

const listProjects = async (candidateProfileId) =>
  CandidateProject.find({ candidateProfileId }).sort({ createdAt: -1 }).lean();

const createProject = async (data, session = null) => {
  const [proj] = await CandidateProject.create([data], session ? { session } : {});
  return proj;
};

const updateProjectByIdAndUser = async (projectId, userId, updates) =>
  CandidateProject.findOneAndUpdate(
    { _id: projectId, userId },
    { $set: updates },
    { new: true, runValidators: true }
  );

const deleteProjectByIdAndUser = async (projectId, userId) =>
  CandidateProject.findOneAndDelete({ _id: projectId, userId });

module.exports = {
  findProfileByUserId,
  createProfile,
  updateProfileByUserId,
  listExperiences,
  createExperience,
  deleteExperienceByIdAndUser,
  listSkills,
  upsertSkillsBulk,
  updateSkillByIdAndUser,
  deleteSkillByIdAndUser,
  listProjects,
  createProject,
  updateProjectByIdAndUser,
  deleteProjectByIdAndUser,
};
