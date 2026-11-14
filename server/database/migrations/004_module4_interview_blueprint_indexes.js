require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../../config/db');
const { InterviewBlueprint } = require('../../modules/interview-blueprint/models/interviewBlueprint.model');
const { BlueprintJob } = require('../../modules/interview-blueprint/jobs/blueprintJob.model');

const runMigration = async () => {
  await connectDB();
  await Promise.all([
    InterviewBlueprint.syncIndexes(),
    BlueprintJob.syncIndexes(),
  ]);
  console.log('Module 4 interview blueprint indexes synchronized successfully.');
  await mongoose.connection.close();
};

runMigration().catch((err) => {
  console.error('Module 4 migration failed:', err);
  process.exit(1);
});
