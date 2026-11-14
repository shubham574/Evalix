const Assessment = require('../models/Assessment');
const MockInterview = require('../models/MockInterview');
const LiveInterview = require('../models/LiveInterview');
const JobAnalysis = require('../models/JobAnalysis');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
exports.getStats = asyncHandler(async (req, res, next) => {
  const userId = req.auth.userId;

  // Execute all queries concurrently with lean projection for fastest response
  const [assessments, mockInterviews, liveInterviews, analyses] = await Promise.all([
    Assessment.find({ userId })
      .select('_id score jobRole createdAt')
      .sort('-createdAt')
      .lean(),
    MockInterview.find({ userId })
      .select('_id jobRole status overallFeedback.averageScore createdAt')
      .sort('-createdAt')
      .lean(),
    LiveInterview.find({ userId })
      .select('_id jobRole status overallFeedback.averageScore difficulty createdAt')
      .sort('-createdAt')
      .lean(),
    JobAnalysis.find({ userId })
      .select('_id jobRole createdAt')
      .sort('-createdAt')
      .lean(),
  ]);

  // 1. Basic Counts
  const totalAssessments = assessments.length;
  const totalLiveInterviews = liveInterviews.length;
  const totalStructuredMocks = mockInterviews.length;
  const totalMockInterviews = totalStructuredMocks + totalLiveInterviews;
  const totalAnalyses = analyses.length;

  // 2. Average & Best Assessment Score
  let averageScore = 0;
  let bestAssessmentScore = 0;
  let passedAssessmentsCount = 0;
  if (assessments.length > 0) {
    const scores = assessments.map((curr) => Math.round(curr.score || 0));
    const totalScore = scores.reduce((acc, s) => acc + s, 0);
    averageScore = Math.round(totalScore / assessments.length);
    bestAssessmentScore = Math.max(...scores);
    passedAssessmentsCount = scores.filter((s) => s >= 70).length;
  }

  // 3. Interview Readiness (Combined metric of assessments, mocks, and live interviews)
  const completedMocks = mockInterviews.filter(
    (m) => m.status === 'completed' && m.overallFeedback?.averageScore != null
  );
  const completedLive = liveInterviews.filter(
    (l) => l.status === 'completed' && l.overallFeedback?.averageScore != null
  );
  const allCompletedInterviews = [...completedMocks, ...completedLive];

  const avgLiveScore =
    completedLive.length > 0
      ? Math.round(
          completedLive.reduce((acc, c) => acc + (c.overallFeedback?.averageScore || 0), 0) /
            completedLive.length
        )
      : 0;

  const avgMockScore =
    completedMocks.length > 0
      ? Math.round(
          completedMocks.reduce((acc, c) => acc + (c.overallFeedback?.averageScore || 0), 0) /
            completedMocks.length
        )
      : 0;

  let averageInterviewScore = 0;
  if (allCompletedInterviews.length > 0) {
    const totalInterviewScore = allCompletedInterviews.reduce(
      (acc, curr) => acc + (curr.overallFeedback?.averageScore || 0),
      0
    );
    averageInterviewScore = Math.round(totalInterviewScore / allCompletedInterviews.length);
  }

  // Weighted readiness score: 40% Assessments + 60% Practical Interviews
  let readinessScore = 0;
  if (assessments.length > 0 && allCompletedInterviews.length > 0) {
    readinessScore = Math.round(averageScore * 0.4 + averageInterviewScore * 0.6);
  } else if (allCompletedInterviews.length > 0) {
    readinessScore = averageInterviewScore;
  } else if (assessments.length > 0) {
    readinessScore = averageScore;
  }

  // 4. Topic Performance (Derived or baseline)
  const topicPerformance = [
    { topic: 'System Design', score: Math.min(100, Math.max(40, readinessScore - 5)), target: 80 },
    { topic: 'Data Structures', score: Math.min(100, Math.max(50, averageScore + 5)), target: 80 },
    { topic: 'Core Technical', score: Math.min(100, Math.max(45, readinessScore + 8)), target: 85 },
    {
      topic: 'Communication',
      score: Math.min(100, Math.max(55, averageInterviewScore || 70)),
      target: 85,
    },
  ];

  // Mode Breakdown for interactive comparison
  const modeBreakdown = [
    {
      mode: 'Live Voice',
      key: 'live_interview',
      total: totalLiveInterviews,
      completed: completedLive.length,
      avgScore: avgLiveScore,
    },
    {
      mode: 'Mock Sim',
      key: 'mock_interview',
      total: totalStructuredMocks,
      completed: completedMocks.length,
      avgScore: avgMockScore,
    },
    {
      mode: 'Timed MCQ',
      key: 'assessment',
      total: totalAssessments,
      completed: totalAssessments,
      avgScore: averageScore,
    },
  ];

  // 5. Recent Activity (merged & sorted)
  const activities = [];

  assessments.slice(0, 8).forEach((a) =>
    activities.push({
      id: a._id,
      type: 'assessment',
      role: a.jobRole || 'Technical Assessment',
      title: `Assessment: ${a.jobRole}`,
      date: a.createdAt,
      status: 'completed',
      score: Math.round(a.score || 0),
    })
  );

  mockInterviews.slice(0, 8).forEach((m) =>
    activities.push({
      id: m._id,
      type: 'mock_interview',
      role: m.jobRole || 'Mock Interview',
      title: `Mock Interview: ${m.jobRole}`,
      date: m.createdAt,
      status: m.status,
      score:
        m.overallFeedback?.averageScore != null
          ? Math.round(m.overallFeedback.averageScore)
          : undefined,
    })
  );

  liveInterviews.slice(0, 8).forEach((l) =>
    activities.push({
      id: l._id,
      type: 'live_interview',
      role: l.jobRole || 'Live Voice Session',
      title: `Live Session: ${l.jobRole}`,
      difficulty: l.difficulty,
      date: l.createdAt,
      status: l.status,
      score:
        l.overallFeedback?.averageScore != null
          ? Math.round(l.overallFeedback.averageScore)
          : undefined,
    })
  );

  analyses.slice(0, 8).forEach((ja) =>
    activities.push({
      id: ja._id,
      type: 'job_analysis',
      role: ja.jobRole || 'Job Analysis',
      title: `Job Analysis: ${ja.jobRole}`,
      date: ja.createdAt,
      status: 'saved',
    })
  );

  // Sort activities by date descending
  activities.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Combined scored timeline (Assessments + Completed Mocks + Completed Live Interviews)
  const scoredEvents = [
    ...assessments.map((a) => ({
      rawDate: new Date(a.createdAt),
      name: new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: Math.round(a.score || 0),
      mode: 'assessment',
      modeLabel: 'MCQ',
      role: a.jobRole || 'MCQ Test',
    })),
    ...completedMocks.map((m) => ({
      rawDate: new Date(m.createdAt),
      name: new Date(m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: Math.round(m.overallFeedback?.averageScore || 0),
      mode: 'mock_interview',
      modeLabel: 'Mock',
      role: m.jobRole || 'Mock Sim',
    })),
    ...completedLive.map((l) => ({
      rawDate: new Date(l.createdAt),
      name: new Date(l.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: Math.round(l.overallFeedback?.averageScore || 0),
      mode: 'live_interview',
      modeLabel: 'Voice',
      role: l.jobRole || 'Voice Session',
    })),
  ]
    .sort((a, b) => a.rawDate - b.rawDate)
    .slice(-14)
    .map(({ rawDate, ...rest }) => rest);

  // Compute recent score delta (last session vs previous average)
  let scoreDelta = 0;
  if (scoredEvents.length >= 2) {
    const latest = scoredEvents[scoredEvents.length - 1].score;
    const prevAvg = Math.round(
      scoredEvents.slice(0, -1).reduce((acc, item) => acc + item.score, 0) /
        (scoredEvents.length - 1)
    );
    scoreDelta = latest - prevAvg;
  }

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalAssessments,
        totalLiveInterviews,
        totalStructuredMocks,
        totalMockInterviews,
        totalAnalyses,
        averageScore,
        averageInterviewScore,
        avgLiveScore,
        avgMockScore,
        bestAssessmentScore,
        passedAssessmentsCount,
        readinessScore,
        scoreDelta,
        completedInterviewsCount: allCompletedInterviews.length,
      },
      modeBreakdown,
      topicPerformance,
      progressOverTime: scoredEvents,
      recentActivity: activities.slice(0, 12),
    },
  });
});
