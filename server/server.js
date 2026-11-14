require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { clerkMiddleware } = require('@clerk/express');
const { connectDB, isDBConnected } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Connect to database
connectDB();

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
if (process.env.LOAD_TEST !== 'true') {
  app.use(morgan('dev'));
}
app.use(clerkMiddleware());

// Routes
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

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    database: isDBConnected() ? 'connected' : 'disconnected',
  });
});

// Error Handler Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', 4096, () => {
  console.log(`Server running on port ${PORT}`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
