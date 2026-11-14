require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../../config/db');
const { CandidateJobAnalysis } = require('../../modules/candidate-intelligence/analysis/candidateJobAnalysis.model');
const { CandidateRequirementAssessment } = require('../../modules/candidate-intelligence/analysis/candidateRequirementAssessment.model');
const { CandidateClaimReview } = require('../../modules/candidate-intelligence/candidate-review/candidateClaimReview.model');
const { CandidateAnalysisJob } = require('../../modules/candidate-intelligence/jobs/analysisJob.model');

const runMigration = async () => {
  await connectDB();
  await Promise.all([
    CandidateJobAnalysis.syncIndexes(),
    CandidateRequirementAssessment.syncIndexes(),
    CandidateClaimReview.syncIndexes(),
    CandidateAnalysisJob.syncIndexes(),
  ]);
  console.log('Module 3 candidate intelligence indexes synchronized successfully.');
  await mongoose.connection.close();
};

runMigration().catch((err) => {
  console.error('Module 3 migration failed:', err);
  process.exit(1);
});
