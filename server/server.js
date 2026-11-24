require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const app = require('./app');
const { ExtractionWorker } = require('./modules/document-intelligence/jobs/extraction.worker');
const { AnalysisWorker } = require('./modules/candidate-intelligence/jobs/analysis.worker');
const { BlueprintWorker } = require('./modules/interview-blueprint/jobs/blueprint.worker');
const { EvaluationWorker } = require('./modules/interview-evaluation/jobs/evaluation.worker');
const { DecisionIntelligenceWorker } = require('./modules/decision-intelligence/jobs/decision-intelligence.worker');
const { InactivitySweeper } = require('./modules/interview-orchestrator/runtime/inactivity-sweeper');

// Connect to database
connectDB();

const worker = new ExtractionWorker();
const analysisWorker = new AnalysisWorker();
const blueprintWorker = new BlueprintWorker();
const evaluationWorker = new EvaluationWorker();
const decisionWorker = new DecisionIntelligenceWorker();
// Abandons interview sessions left idle past INTERVIEW_ORCHESTRATOR_(PAUSED_)ABANDON_AFTER_MS
const inactivitySweeper = new InactivitySweeper();
mongoose.connection.once('connected', () => {
  void worker.start();
  void analysisWorker.start();
  void blueprintWorker.start();
  void evaluationWorker.start();
  void decisionWorker.start();
  inactivitySweeper.start();
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', 4096, () => {
  console.log(`Server running on port ${PORT}`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.allSettled([
    worker.stop(),
    analysisWorker.stop(),
    blueprintWorker.stop(),
    evaluationWorker.stop(),
    decisionWorker.stop(),
    inactivitySweeper.stop(),
  ]);
  server.close(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  });
  // Don't hang forever on keep-alive sockets
  setTimeout(() => process.exit(0), 10000).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Safety net: a stray rejected promise in a request handler or background job must not take
// down the whole API process (Node's default for unhandled rejections is to crash).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason instanceof Error ? reason.stack : reason);
});
