require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../../config/env');
const {
  InterviewEvaluationRun,
} = require('../../modules/interview-evaluation/models/interviewEvaluationRun.model');
const {
  QuestionEvaluation,
} = require('../../modules/interview-evaluation/models/questionEvaluation.model');
const {
  CompetencyEvaluation,
} = require('../../modules/interview-evaluation/models/competencyEvaluation.model');
const {
  InterviewReport,
} = require('../../modules/interview-evaluation/models/interviewReport.model');
const {
  InterviewEvaluationJob,
} = require('../../modules/interview-evaluation/models/interviewEvaluationJob.model');
const {
  EvaluationReviewEvent,
} = require('../../modules/interview-evaluation/models/evaluationReviewEvent.model');

const runMigration = async () => {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([
    InterviewEvaluationRun.syncIndexes(),
    QuestionEvaluation.syncIndexes(),
    CompetencyEvaluation.syncIndexes(),
    InterviewReport.syncIndexes(),
    InterviewEvaluationJob.syncIndexes(),
    EvaluationReviewEvent.syncIndexes(),
  ]);
  console.log('Module 6 interview evaluation indexes synchronized.');
  await mongoose.disconnect();
};

if (require.main === module) {
  runMigration().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigration };
