import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
// Components
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loader from './components/ui/Loader';
import { TooltipProvider } from './components/shadcn/tooltip';
import { MotionConfig } from 'motion/react';
import { isMotionOff } from './components/studio/Gamify';

const MOTION_OFF = typeof window !== 'undefined' && isMotionOff();
if (MOTION_OFF) document.documentElement.classList.add('motion-off');

// Pages
const Landing = React.lazy(() => import('./pages/Landing'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const JobAnalysis = React.lazy(() => import('./pages/JobAnalysis'));
const MCQGenerator = React.lazy(() => import('./pages/MCQGenerator'));
const AssessmentTest = React.lazy(() => import('./pages/AssessmentTest'));
const InterviewQuestions = React.lazy(() => import('./pages/InterviewQuestions'));
const MockInterview = React.lazy(() => import('./pages/MockInterview'));
const ResumeAnalyzer = React.lazy(() => import('./pages/ResumeAnalyzer'));
const History = React.lazy(() => import('./pages/History'));
const Profile = React.lazy(() => import('./pages/Profile'));
const LiveInterview = React.lazy(() => import('./pages/LiveInterview'));
const ReactMockInterview = React.lazy(() => import('./pages/ReactMockInterview'));
const ResumeQuestions = React.lazy(() => import('./pages/ResumeQuestions'));
const SystemDesignMockInterview = React.lazy(() => import('./pages/SystemDesignMockInterview'));
const FreshersMockInterview = React.lazy(() => import('./pages/FreshersMockInterview'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion={MOTION_OFF ? 'always' : 'user'}>
        <TooltipProvider delayDuration={200}>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                borderRadius: '999px',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-md)',
                padding: '10px 16px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#1F8A4C', secondary: '#fff' } },
              error: { iconTheme: { primary: '#D92D20', secondary: '#fff' } },
            }}
          />
          <React.Suspense fallback={<Loader fullScreen text="Loading Evalix Arena..." />}>
            <Routes>
              {/* Public Marketing & SEO Landing Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/mock-interview-for-react-developers" element={<ReactMockInterview />} />
              <Route path="/resume-based-interview-questions" element={<ResumeQuestions />} />
              <Route path="/system-design-mock-interview" element={<SystemDesignMockInterview />} />
              <Route path="/mock-interview-for-freshers" element={<FreshersMockInterview />} />
              <Route path="/login/*" element={<Login />} />
              <Route path="/register/*" element={<Register />} />

              {/* Protected Routes inside Layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/job-analysis" element={<JobAnalysis />} />
                <Route path="/mcq-generator" element={<MCQGenerator />} />
                <Route path="/assessment/:id" element={<AssessmentTest />} />
                <Route path="/interview-questions" element={<InterviewQuestions />} />
                <Route path="/mock-interview" element={<MockInterview />} />
                <Route path="/live-interview" element={<LiveInterview />} />
                <Route path="/resume-analyzer" element={<ResumeAnalyzer />} />
                <Route path="/history" element={<History />} />
                <Route path="/profile/*" element={<Profile />} />
              </Route>
            </Routes>
          </React.Suspense>
        </Router>
        </TooltipProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
