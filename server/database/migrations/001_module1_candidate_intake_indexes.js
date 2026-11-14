require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../../config/db');
const { CandidateProfile } = require('../../modules/candidate/candidateProfile.model');
const { CandidateExperience } = require('../../modules/candidate/candidateExperience.model');
const { CandidateSkill } = require('../../modules/candidate/candidateSkill.model');
const { CandidateProject } = require('../../modules/candidate/candidateProject.model');
const { CandidateDocument } = require('../../modules/documents/candidateDocument.model');
const { TargetJobProfile } = require('../../modules/job-profile/targetJobProfile.model');
const { InterviewIntake } = require('../../modules/intake/interviewIntake.model');

const MODULE_1_MODELS = [
  CandidateProfile,
  CandidateExperience,
  CandidateSkill,
  CandidateProject,
  CandidateDocument,
  TargetJobProfile,
  InterviewIntake,
];

/**
 * Idempotent migration: ensures all Module 1 collections and indexes exist.
 */
async function syncModule1Indexes() {
  for (const Model of MODULE_1_MODELS) {
    await Model.createCollection().catch(() => {});
    await Model.syncIndexes();
  }
}

if (require.main === module) {
  (async () => {
    await connectDB();
    await syncModule1Indexes();
    console.log('Module 1 collections and indexes synchronized successfully.');
    await mongoose.disconnect();
    process.exit(0);
  })().catch(async (err) => {
    console.error('Migration failed:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { syncModule1Indexes };
