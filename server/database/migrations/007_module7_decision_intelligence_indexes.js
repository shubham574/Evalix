require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../../config/env');
const {
  StudentPracticeReport,
} = require('../../modules/decision-intelligence/reports/studentPracticeReport.model');
const {
  DecisionSupportReport,
} = require('../../modules/decision-intelligence/reports/decisionSupportReport.model');
const {
  CandidateDevelopmentPlan,
} = require('../../modules/decision-intelligence/development/candidateDevelopmentPlan.model');
const {
  DevelopmentProgressEvent,
} = require('../../modules/decision-intelligence/development/developmentProgressEvent.model');
const {
  EvaluationQualityReport,
} = require('../../modules/decision-intelligence/quality/evaluationQualityReport.model');
const {
  EvaluationCalibrationObservation,
} = require('../../modules/decision-intelligence/calibration/evaluationCalibrationObservation.model');
const {
  EvaluationCalibrationSummary,
} = require('../../modules/decision-intelligence/calibration/evaluationCalibrationSummary.model');
const {
  RecruiterDecisionRecord,
} = require('../../modules/decision-intelligence/decisions/recruiterDecisionRecord.model');
const {
  DecisionIntelligenceJob,
} = require('../../modules/decision-intelligence/jobs/decisionIntelligenceJob.model');

const runMigration = async () => {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([
    StudentPracticeReport.syncIndexes(),
    DecisionSupportReport.syncIndexes(),
    CandidateDevelopmentPlan.syncIndexes(),
    DevelopmentProgressEvent.syncIndexes(),
    EvaluationQualityReport.syncIndexes(),
    EvaluationCalibrationObservation.syncIndexes(),
    EvaluationCalibrationSummary.syncIndexes(),
    RecruiterDecisionRecord.syncIndexes(),
    DecisionIntelligenceJob.syncIndexes(),
  ]);
  console.log('Module 7 decision intelligence indexes synchronized.');
  await mongoose.disconnect();
};

if (require.main === module) {
  runMigration().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigration };
