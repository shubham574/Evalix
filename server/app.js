require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { clerkMiddleware } = require('@clerk/express');
const { isDBConnected } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:30001',
    'http://localhost:5173',
    process.env.CLIENT_URL,
    'https://interview-ai-ten-psi.vercel.app',
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
if (process.env.LOAD_TEST !== 'true' && process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}
app.use(clerkMiddleware());

// Existing Routes
const jobAnalysisRoutes = require('./routes/jobAnalysis.routes');
const mcqRoutes = require('./routes/mcq.routes');
const assessmentRoutes = require('./routes/assessment.routes');
const interviewRoutes = require('./routes/interview.routes');
const mockInterviewRoutes = require('./routes/mockInterview.routes');
const resumeRoutes = require('./routes/resume.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const historyRoutes = require('./routes/history.routes');
const studyRoutes = require('./routes/study.routes');
const transcriptionRoutes = require('./routes/transcription.routes');
const liveInterviewRoutes = require('./routes/liveInterview.routes');

app.use('/api/job-analysis', jobAnalysisRoutes);
app.use('/api/mcqs', mcqRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/mock-interview', mockInterviewRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/transcribe', transcriptionRoutes);
app.use('/api/live-interview', liveInterviewRoutes);

// Module 1 & 2 (v1): Candidate Intake, Documents & Document Intelligence Routes
const candidateRoutes = require('./modules/candidate/candidate.routes');
const intakeRoutes = require('./modules/intake/intake.routes');
const documentRoutes = require('./modules/documents/document.routes');
const documentIntelligenceRoutes = require('./modules/document-intelligence/document-intelligence.routes');
const candidateIntelligenceRoutes = require('./modules/candidate-intelligence/candidate-intelligence.routes');
const interviewBlueprintRoutes = require('./modules/interview-blueprint/interview-blueprint.routes');
const {
  intakeSessionRouter,
  candidateSessionRouter,
  internalSessionRouter,
} = require('./modules/interview-orchestrator/interview-orchestrator.routes');
const {
  sessionEvaluationRouter,
  reviewEvaluationRouter,
} = require('./modules/interview-evaluation/interview-evaluation.routes');
const {
  sessionDecisionRouter,
  candidateProgressRouter,
  developmentPlanRouter,
  internalQualityRouter,
} = require('./modules/decision-intelligence/decision-intelligence.routes');

app.use('/api/v1/candidates', candidateRoutes);
app.use('/api/v1/candidates', candidateProgressRouter);
app.use('/api/v1/interview-intakes', intakeRoutes);
app.use('/api/v1/interview-intakes', documentIntelligenceRoutes);
app.use('/api/v1/interview-intakes', candidateIntelligenceRoutes);
app.use('/api/v1/interview-intakes', interviewBlueprintRoutes);
app.use('/api/v1/interview-intakes', intakeSessionRouter);
app.use('/api/v1/interview-sessions', candidateSessionRouter);
app.use('/api/v1/interview-sessions', sessionEvaluationRouter);
app.use('/api/v1/interview-sessions', sessionDecisionRouter);
app.use('/api/v1/interview-evaluations', reviewEvaluationRouter);
app.use('/api/v1/development-plans', developmentPlanRouter);
app.use('/api/v1/internal/interview-intakes', interviewBlueprintRoutes.internalRouter);
app.use('/api/v1/internal/interview-sessions', internalSessionRouter);
app.use('/api/v1/internal', internalQualityRouter);
app.use('/api/v1/documents', documentRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    database: isDBConnected() ? 'connected' : 'disconnected',
  });
});

// Error Handler Middleware
app.use(errorHandler);

module.exports = app;
