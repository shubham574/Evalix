require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../../config/env');
const InterviewSession = require('../../modules/interview-orchestrator/session/interviewSession.model');
const InterviewTurn = require('../../modules/interview-orchestrator/turns/interviewTurn.model');
const SessionMemory = require('../../modules/interview-orchestrator/memory/sessionMemory.model');
const InterviewEvent = require('../../modules/interview-orchestrator/events/interviewEvent.model');

const runMigration = async () => {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([
    InterviewSession.syncIndexes(),
    InterviewTurn.syncIndexes(),
    SessionMemory.syncIndexes(),
    InterviewEvent.syncIndexes(),
  ]);
  console.log('Module 5 interview orchestrator indexes synchronized.');
  await mongoose.disconnect();
};

if (require.main === module) {
  runMigration().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigration };
