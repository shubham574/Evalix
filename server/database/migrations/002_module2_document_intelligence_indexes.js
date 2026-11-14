require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../../config/db');
const { DocumentExtraction } = require('../../modules/document-intelligence/extraction/documentExtraction.model');
const { DocumentExtractionJob } = require('../../modules/document-intelligence/jobs/extractionJob.model');
const { IntakeIntelligenceRun } = require('../../modules/document-intelligence/extraction/intakeIntelligenceRun.model');

const MODULE_2_MODELS = [
  DocumentExtraction,
  DocumentExtractionJob,
  IntakeIntelligenceRun,
];

async function syncModule2Indexes() {
  for (const Model of MODULE_2_MODELS) {
    await Model.createCollection().catch(() => {});
    await Model.syncIndexes();
  }
}

if (require.main === module) {
  (async () => {
    await connectDB();
    await syncModule2Indexes();
    console.log('Module 2 collections and indexes synchronized successfully.');
    await mongoose.disconnect();
    process.exit(0);
  })().catch(async (err) => {
    console.error('Module 2 migration failed:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { syncModule2Indexes };
