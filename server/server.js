require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const app = require('./app');
const { ExtractionWorker } = require('./modules/document-intelligence/jobs/extraction.worker');
const { AnalysisWorker } = require('./modules/candidate-intelligence/jobs/analysis.worker');
const { BlueprintWorker } = require('./modules/interview-blueprint/jobs/blueprint.worker');
const { EvaluationWorker } = require('./modules/interview-evaluation/jobs/evaluation.worker');
const { DecisionIntelligenceWorker } = require('./modules/decision-intelligence/jobs/decision-intelligence.worker');

// Connect to database
connectDB();

const worker = new ExtractionWorker();
const analysisWorker = new AnalysisWorker();
const blueprintWorker = new BlueprintWorker();
const evaluationWorker = new EvaluationWorker();
const decisionWorker = new DecisionIntelligenceWorker();
mongoose.connection.once('connected', () => {
  void worker.start();
  void analysisWorker.start();
  void blueprintWorker.start();
  void evaluationWorker.start();
  void decisionWorker.start();
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', 4096, () => {
  console.log(`Server running on port ${PORT}`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const shutdown = async () => {
  await worker.stop();
  await analysisWorker.stop();
  await blueprintWorker.stop();
  await evaluationWorker.stop();
  await decisionWorker.stop();
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
