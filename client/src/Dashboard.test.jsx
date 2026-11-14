import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from './pages/Dashboard';

// Mock Clerk user
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({
    user: { firstName: 'Alex', fullName: 'Alex Rivera' },
    isSignedIn: true,
  }),
  UserButton: () => <div>UserButton</div>,
}));

// Mock useApiQuery
const mockApiData = {
  data: {
    stats: {
      totalAssessments: 0,
      totalLiveInterviews: 0,
      totalStructuredMocks: 0,
      totalMockInterviews: 0,
      totalAnalyses: 0,
      averageScore: 0,
      averageInterviewScore: 0,
      readinessScore: 0,
      completedInterviewsCount: 0,
      scoreDelta: 0,
    },
    modeBreakdown: [],
    topicPerformance: [],
    progressOverTime: [],
    recentActivity: [],
  },
};

let currentResponse = mockApiData;

vi.mock('./hooks/useApi', () => ({
  useApiQuery: () => ({
    data: currentResponse,
    isLoading: false,
  }),
}));

// Mock recharts ResponsiveContainer
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: '500px', height: '300px' }}>{children}</div>
    ),
  };
});

describe('Dashboard Component', () => {
  it('displays "NOT ASSESSED YET" and intentional empty states when user has no completed sessions', () => {
    currentResponse = mockApiData;
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Verify readiness empty state
    expect(screen.getByText('NOT ASSESSED YET')).toBeInTheDocument();
    expect(
      screen.getByText(/Complete your first interview to establish your readiness score/i)
    ).toBeInTheDocument();

    // Verify analytics empty state
    expect(screen.getByText(/Your first score starts here/i)).toBeInTheDocument();

    // Verify recent activity empty state
    expect(screen.getByText(/Nothing here yet/i)).toBeInTheDocument();

    // Verify greeting and featured module
    expect(screen.getByText(/Ready for your next round\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Voice Interview/i)).toBeInTheDocument();
  });

  it('displays calculated readiness score when evaluated sessions exist', () => {
    currentResponse = {
      data: {
        stats: {
          totalAssessments: 5,
          totalLiveInterviews: 2,
          totalStructuredMocks: 3,
          totalMockInterviews: 5,
          totalAnalyses: 2,
          averageScore: 82,
          averageInterviewScore: 86,
          readinessScore: 84,
          completedInterviewsCount: 5,
          scoreDelta: 4,
        },
        modeBreakdown: [
          { mode: 'Live Voice', key: 'live_interview', total: 2, completed: 2, avgScore: 88 },
          { mode: 'Mock Sim', key: 'mock_interview', total: 3, completed: 3, avgScore: 84 },
        ],
        topicPerformance: [
          { topic: 'System Design', score: 80, target: 80 },
          { topic: 'Data Structures', score: 85, target: 80 },
        ],
        progressOverTime: [
          { name: 'Nov 10', score: 80, mode: 'assessment', modeLabel: 'MCQ', role: 'React Dev' },
          { name: 'Nov 11', score: 88, mode: 'live_interview', modeLabel: 'Voice', role: 'React Dev' },
        ],
        recentActivity: [
          {
            id: '1',
            type: 'live_interview',
            role: 'React Developer',
            date: new Date().toISOString(),
            status: 'completed',
            score: 88,
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Verify readiness score is rendered as 84%
    const scoreElements = screen.getAllByText('84%');
    expect(scoreElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Target 80%/i)).toBeInTheDocument();
    expect(screen.getByText(/\+4% vs prior/i)).toBeInTheDocument();
  });

  it('allows interactive track selection and mode toggling', () => {
    currentResponse = {
      data: {
        stats: {
          totalAssessments: 2,
          totalLiveInterviews: 1,
          totalStructuredMocks: 1,
          totalMockInterviews: 2,
          totalAnalyses: 1,
          averageScore: 78,
          averageInterviewScore: 82,
          readinessScore: 80,
          completedInterviewsCount: 2,
          scoreDelta: 0,
        },
        modeBreakdown: [
          { mode: 'Live Voice', key: 'live_interview', total: 1, completed: 1, avgScore: 82 },
        ],
        topicPerformance: [
          { topic: 'System Design', score: 80, target: 80 },
        ],
        progressOverTime: [
          { name: 'Nov 11', score: 82, mode: 'live_interview', modeLabel: 'Voice', role: 'Node.js Dev' },
        ],
        recentActivity: [],
      },
    };

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Click track button
    const sysDesignTrackBtn = screen.getByRole('button', { name: /System Design/i });
    fireEvent.click(sysDesignTrackBtn);
    expect(screen.getByText(/System Design & Architecture/i)).toBeInTheDocument();

    // Click By Mode toggle in Competency breakdown
    const byModeBtn = screen.getByRole('button', { name: /By Mode/i });
    fireEvent.click(byModeBtn);
    expect(screen.getByText(/1 Total Runs/i)).toBeInTheDocument();

    // Click Bars toggle
    const barsBtn = screen.getByRole('button', { name: /Bars/i });
    fireEvent.click(barsBtn);
    expect(barsBtn).toHaveClass('bg-[#151515]');
  });
});
