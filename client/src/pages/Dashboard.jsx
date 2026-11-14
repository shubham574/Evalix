import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  FiArrowRight,
  FiArrowUpRight,
  FiMic,
  FiVideo,
  FiList,
  FiFileText,
  FiBriefcase,
  FiTool,
  FiSearch,
  FiCheckCircle,
  FiAward,
  FiTrendingUp,
  FiClock,
  FiActivity,
} from 'react-icons/fi';
import { useApiQuery } from '../hooks/useApi';
import { API } from '../api/endpoints';
import SEOHead from '../components/common/SEOHead';
import DashboardSkeleton from '../components/ui/DashboardSkeleton';
import { formatDate } from '../utils/helpers';
import { useUser } from '@clerk/clerk-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const ROLE_PRESETS = [
  {
    id: 'react',
    label: 'React Frontend',
    role: 'Frontend Developer (React)',
    skills: 'React, TypeScript, Hooks, State Management, Performance',
  },
  {
    id: 'fullstack',
    label: 'Full Stack MERN',
    role: 'Full Stack Engineer (MERN)',
    skills: 'React, Node.js, Express, MongoDB, REST APIs',
  },
  {
    id: 'backend',
    label: 'Node.js Backend',
    role: 'Backend Engineer (Node.js)',
    skills: 'Node.js, PostgreSQL, Redis, Caching, Microservices',
  },
  {
    id: 'sysdesign',
    label: 'System Design',
    role: 'System Design & Architecture',
    skills: 'Scalability, Load Balancing, Sharding, Queues, CAP Theorem',
  },
  {
    id: 'sde1',
    label: 'SDE-1 / Fresher',
    role: 'Software Development Engineer (SDE-1)',
    skills: 'Data Structures, Algorithms, OOP, DBMS, OS',
  },
];

const GHOST_CHART_PREVIEW = [
  { name: 'Session 1', score: 62 },
  { name: 'Session 2', score: 71 },
  { name: 'Session 3', score: 68 },
  { name: 'Session 4', score: 82 },
  { name: 'Session 5', score: 89 },
];

const Dashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const { data: response, isLoading } = useApiQuery('dashboardStats', API.DASHBOARD.STATS);

  // Interactive Dashboard States
  const [selectedPresetId, setSelectedPresetId] = useState('react');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'live_interview' | 'mock_interview' | 'assessment' | 'job_analysis'
  const [chartType, setChartType] = useState('area'); // 'area' | 'bar'
  const [rightTab, setRightTab] = useState('topics'); // 'topics' | 'modes'
  const [searchQuery, setSearchQuery] = useState('');

  const selectedPreset = useMemo(
    () => ROLE_PRESETS.find((p) => p.id === selectedPresetId) || ROLE_PRESETS[0],
    [selectedPresetId]
  );

  const {
    stats = {},
    modeBreakdown = [],
    topicPerformance = [],
    progressOverTime = [],
    recentActivity = [],
  } = response?.data || {};

  // Compute evaluation status
  const totalCompletedInterviews = stats?.completedInterviewsCount || 0;
  const totalAssessments = stats?.totalAssessments || 0;
  const hasEvaluatedData =
    (totalCompletedInterviews > 0 || totalAssessments > 0) &&
    progressOverTime &&
    progressOverTime.length > 0;

  const readinessScore = stats?.readinessScore || 0;
  const isAssessed = hasEvaluatedData && readinessScore > 0;
  const totalSessions =
    (stats?.totalMockInterviews || 0) + (stats?.totalAssessments || 0);
  const scoreDelta = stats?.scoreDelta || 0;

  // Filtered Chart Data based on interactive selection
  const filteredChartData = useMemo(() => {
    if (!progressOverTime?.length) return [];
    if (activeFilter === 'all' || activeFilter === 'job_analysis') return progressOverTime;
    if (activeFilter === 'interviews') {
      return progressOverTime.filter(
        (d) => d.mode === 'live_interview' || d.mode === 'mock_interview'
      );
    }
    return progressOverTime.filter((d) => d.mode === activeFilter);
  }, [progressOverTime, activeFilter]);

  // Dynamic Chart Summary Stats
  const chartSummary = useMemo(() => {
    if (!filteredChartData.length) {
      return { count: 0, avg: 0, peak: 0, latest: 0 };
    }
    const scores = filteredChartData.map((d) => Number(d.score || 0));
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const peak = Math.max(...scores);
    const latest = scores[scores.length - 1];
    return { count: scores.length, avg, peak, latest };
  }, [filteredChartData]);

  // Filtered Recent Activity Table
  const filteredActivities = useMemo(() => {
    return (recentActivity || []).filter((item) => {
      const matchesMode =
        activeFilter === 'all'
          ? true
          : activeFilter === 'interviews'
          ? item.type === 'live_interview' || item.type === 'mock_interview'
          : item.type === activeFilter;

      const matchesSearch =
        !searchQuery.trim() ||
        (item.role || item.title || '')
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase());

      return matchesMode && matchesSearch;
    });
  }, [recentActivity, activeFilter, searchQuery]);

  // Dynamic Greeting based on client local time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }, []);

  const candidateName = user?.firstName
    ? user.firstName.toUpperCase()
    : 'CANDIDATE';

  // GSAP Entry Animation
  useEffect(() => {
    if (isLoading || !containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.dash-section', {
        opacity: 0,
        y: 16,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out',
        clearProps: 'all',
      });
    }, containerRef);

    return () => ctx.revert();
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SEOHead title="Dashboard — Evalix" />
        <DashboardSkeleton />
      </div>
    );
  }

  const getActivityLink = (activity) => {
    if (activity.type === 'assessment' && activity.id) return `/assessment/${activity.id}`;
    if (activity.type === 'live_interview') return '/live-interview';
    if (activity.type === 'mock_interview') return '/mock-interview';
    if (activity.type === 'job_analysis') return '/job-analysis';
    return '/history';
  };

  const getModeBadge = (type) => {
    switch (type) {
      case 'live_interview':
        return { label: 'VOICE', cls: 'bg-[#FF6B35]/15 text-[#FF6B35] border-[#FF6B35]/30' };
      case 'mock_interview':
        return { label: 'MOCK', cls: 'bg-[#C7F36B]/35 text-[#151515] dark:text-[#C7F36B] border-[#151515]/20' };
      case 'assessment':
        return { label: 'MCQ', cls: 'bg-[#8174FF]/15 text-[#8174FF] border-[#8174FF]/30' };
      case 'job_analysis':
        return { label: 'JD PLAN', cls: 'bg-bg-elevated text-text-secondary border-border-subtle' };
      default:
        return { label: 'SESSION', cls: 'bg-bg-elevated text-text-secondary border-border-subtle' };
    }
  };

  return (
    <div ref={containerRef} className="space-y-6 pb-12">
      <SEOHead title="Dashboard — Evalix Studio" />

      {/* ─── 1. Welcome Header & Featured Voice Quick-Start ─── */}
      <section className="dash-section rounded-[20px] bg-bg-surface border border-border-subtle p-5 sm:p-7 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Editorial Greeting & Context */}
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-[#FF6B35] font-bold">
                {greeting}, {candidateName}.
              </span>
              <span className="text-text-muted text-xs">&bull;</span>
              <span className="font-mono text-xs text-text-secondary">
                {selectedPreset.label}
              </span>
              <span className="text-text-muted text-xs">&bull;</span>
              <span className="font-mono text-xs text-text-secondary">
                {totalSessions} {totalSessions === 1 ? 'Session' : 'Sessions'} Recorded
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight text-text-primary leading-tight">
              Ready for your next round?
            </h1>

            <p className="text-sm text-text-secondary max-w-lg leading-relaxed">
              Your interview preparation starts here. Launch an adaptive voice session with Shristi AI or calibrate your readiness with targeted tracks.
            </p>

            {/* Track Selector Bar */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted font-bold">
                  Target Track:
                </span>
                <span className="text-xs font-mono text-[#FF6B35] font-semibold">
                  {selectedPreset.role}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`relative px-3 py-1.5 rounded-[9px] text-xs font-mono transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#151515] text-[#F8F5EF] border-[#151515] font-bold'
                          : 'bg-bg-canvas text-text-secondary border-border-subtle hover:border-text-primary hover:text-text-primary font-medium'
                      }`}
                    >
                      {preset.label}
                      {isSelected && (
                        <motion.div
                          layoutId="activePresetPill"
                          className="absolute -bottom-1 left-2 right-2 h-[2px] bg-[#FF6B35] rounded-full"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Prominent Voice Interview Action Card */}
          <div className="shrink-0 w-full lg:w-80 rounded-[16px] bg-bg-canvas border border-border-subtle p-5 flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#FF6B35] font-bold">
                  VOICE SIMULATION
                </span>
                <h2 className="text-base font-display font-bold text-text-primary">
                  Start a Voice Interview
                </h2>
                <p className="text-xs text-text-secondary">
                  Practice with Shristi AI under real conversational pressure.
                </p>
              </div>
              <div className="w-10 h-10 rounded-[10px] bg-[#FF6B35]/12 border border-[#FF6B35]/30 flex items-center justify-center text-[#FF6B35] shrink-0">
                <FiMic size={18} />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  navigate('/live-interview', {
                    state: { jobRole: selectedPreset.role, skills: selectedPreset.skills },
                  })
                }
                className="w-full py-2.5 px-4 rounded-[11px] bg-[#FF6B35] hover:bg-[#EB5822] text-white font-display font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer group"
              >
                <span>START SESSION</span>
                <FiArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate('/mcq-generator', {
                    state: { jobRole: selectedPreset.role, skills: selectedPreset.skills },
                  })
                }
                className="w-full py-2 px-3 rounded-[9px] bg-bg-surface hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Drill MCQs Instead</span>
                <FiArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. Metrics & Readiness Hierarchy (Click Any Card to Filter) ─── */}
      <section className="dash-section grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Readiness Index (Hero Metric) */}
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`text-left rounded-[18px] p-5 border transition-all cursor-pointer flex flex-col justify-between ${
            activeFilter === 'all'
              ? 'bg-bg-surface border-[#FF6B35] ring-2 ring-[#FF6B35]/25 shadow-xs'
              : 'bg-bg-surface border-border-subtle hover:border-text-primary'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-text-muted">
              READINESS INDEX
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                isAssessed
                  ? readinessScore >= 80
                    ? 'bg-[#C7F36B]/25 text-emerald-700 dark:text-[#C7F36B]'
                    : 'bg-[#FF6B35]/15 text-[#FF6B35]'
                  : 'bg-bg-canvas text-text-muted border border-border-subtle'
              }`}
            >
              {isAssessed ? 'TARGET 80%' : 'ESTABLISHING'}
            </span>
          </div>

          <div className="my-3">
            {isAssessed ? (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-editorial tracking-tight text-text-primary leading-none">
                  {readinessScore}%
                </span>
                {scoreDelta !== 0 && (
                  <span
                    className={`text-xs font-mono font-bold ${
                      scoreDelta > 0 ? 'text-emerald-600 dark:text-[#C7F36B]' : 'text-[#FF6B35]'
                    }`}
                  >
                    {scoreDelta > 0 ? `+${scoreDelta}%` : `${scoreDelta}%`} vs prior
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-xl font-display font-bold text-text-primary tracking-tight">
                  NOT ASSESSED YET
                </span>
                <p className="text-[11px] text-text-muted leading-tight">
                  Complete your first interview to establish your readiness score.
                </p>
              </div>
            )}
          </div>

          <div className="w-full space-y-1.5 pt-1">
            <div className="w-full h-1.5 rounded-full bg-border-subtle/50 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isAssessed ? 'bg-[#C7F36B]' : 'bg-transparent'
                }`}
                style={{ width: `${isAssessed ? Math.min(100, Math.max(5, readinessScore)) : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-text-muted">
              <span>60% Interview</span>
              <span>40% MCQ</span>
            </div>
          </div>
        </button>

        {/* KPI 2: Voice & Mock Rounds */}
        <button
          type="button"
          onClick={() =>
            setActiveFilter(activeFilter === 'interviews' ? 'all' : 'interviews')
          }
          className={`text-left rounded-[18px] p-5 border transition-all cursor-pointer flex flex-col justify-between ${
            activeFilter === 'interviews' ||
            activeFilter === 'live_interview' ||
            activeFilter === 'mock_interview'
              ? 'bg-bg-surface border-[#FF6B35] ring-2 ring-[#FF6B35]/25 shadow-xs'
              : 'bg-bg-surface border-border-subtle hover:border-text-primary'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-text-muted">
              VOICE &amp; MOCK ROUNDS
            </span>
            <span className="text-[10px] font-mono font-bold text-[#FF6B35] px-1.5 py-0.5 rounded bg-[#FF6B35]/10">
              {stats?.averageInterviewScore || 0}% AVG
            </span>
          </div>

          <div className="my-3 flex items-baseline gap-2">
            <span className="text-4xl font-editorial tracking-tight text-text-primary leading-none">
              {stats?.totalMockInterviews || 0}
            </span>
            <span className="text-xs font-mono text-text-muted">
              ({stats?.completedInterviewsCount || 0} evaluated)
            </span>
          </div>

          <div className="w-full space-y-1.5 pt-1">
            <div className="flex justify-between text-[11px] font-mono text-text-secondary">
              <span>
                Voice: <strong className="text-text-primary">{stats?.totalLiveInterviews || 0}</strong>
              </span>
              <span>
                Mock: <strong className="text-text-primary">{stats?.totalStructuredMocks || 0}</strong>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border-subtle/50 overflow-hidden flex">
              <div
                className="h-full bg-[#FF6B35]"
                style={{
                  width: `${
                    stats?.totalMockInterviews
                      ? Math.round(
                          ((stats?.totalLiveInterviews || 0) / stats.totalMockInterviews) * 100
                        )
                      : 50
                  }%`,
                }}
              />
              <div className="h-full bg-[#8174FF] flex-1" />
            </div>
          </div>
        </button>

        {/* KPI 3: Timed MCQ Assessments */}
        <button
          type="button"
          onClick={() =>
            setActiveFilter(activeFilter === 'assessment' ? 'all' : 'assessment')
          }
          className={`text-left rounded-[18px] p-5 border transition-all cursor-pointer flex flex-col justify-between ${
            activeFilter === 'assessment'
              ? 'bg-bg-surface border-[#FF6B35] ring-2 ring-[#FF6B35]/25 shadow-xs'
              : 'bg-bg-surface border-border-subtle hover:border-text-primary'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-text-muted">
              MCQ ASSESSMENTS
            </span>
            <span className="text-[10px] font-mono font-bold text-[#8174FF] px-1.5 py-0.5 rounded bg-[#8174FF]/10">
              PEAK {stats?.bestAssessmentScore || 0}%
            </span>
          </div>

          <div className="my-3 flex items-baseline gap-2">
            <span className="text-4xl font-editorial tracking-tight text-text-primary leading-none">
              {stats?.totalAssessments || 0}
            </span>
            <span className="text-xs font-mono text-text-muted">
              ({stats?.averageScore || 0}% avg)
            </span>
          </div>

          <div className="w-full space-y-1.5 pt-1">
            <div className="w-full h-1.5 rounded-full bg-border-subtle/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#8174FF] transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(4, stats?.averageScore || 0))}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-text-muted">
              <span>Pass &ge;70%: {stats?.passedAssessmentsCount || 0}</span>
              <span>90s / Q</span>
            </div>
          </div>
        </button>

        {/* KPI 4: JD Plans & Scans */}
        <button
          type="button"
          onClick={() =>
            setActiveFilter(activeFilter === 'job_analysis' ? 'all' : 'job_analysis')
          }
          className={`text-left rounded-[18px] p-5 border transition-all cursor-pointer flex flex-col justify-between ${
            activeFilter === 'job_analysis'
              ? 'bg-bg-surface border-[#FF6B35] ring-2 ring-[#FF6B35]/25 shadow-xs'
              : 'bg-bg-surface border-border-subtle hover:border-text-primary'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-text-muted">
              JD PLANS &amp; SCANS
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-[#C7F36B] px-1.5 py-0.5 rounded bg-emerald-500/10">
              ACTIVE
            </span>
          </div>

          <div className="my-3 flex items-baseline gap-2">
            <span className="text-4xl font-editorial tracking-tight text-text-primary leading-none">
              {stats?.totalAnalyses || 0}
            </span>
            <span className="text-xs font-mono text-text-muted">saved roadmaps</span>
          </div>

          <div className="w-full space-y-1.5 pt-1">
            <div className="w-full h-1.5 rounded-full bg-border-subtle/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(8, (stats?.totalAnalyses || 0) * 20))}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-text-muted">
              <span>Role Alignment</span>
              <span>Gap Analysis</span>
            </div>
          </div>
        </button>
      </section>

      {/* ─── 3. Analytics Workbench (8 Cols Score Timeline + 4 Cols Competency Matrix) ─── */}
      <section className="dash-section grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Cols: Performance Over Time or Intentional Empty State */}
        <div className="lg:col-span-8 rounded-[20px] bg-bg-surface border border-border-subtle p-5 sm:p-6 flex flex-col justify-between">
          <div>
            {/* Chart Filter & Tooling Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-border-subtle">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Scored' },
                  { id: 'live_interview', label: 'Voice' },
                  { id: 'mock_interview', label: 'Mock' },
                  { id: 'assessment', label: 'MCQ' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-3 py-1 rounded-[8px] text-xs font-mono font-bold transition-all cursor-pointer border ${
                      activeFilter === tab.id
                        ? 'bg-[#151515] text-[#F8F5EF] border-[#151515]'
                        : 'bg-bg-canvas text-text-secondary border-border-subtle hover:border-text-primary hover:text-text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Summary Metrics & Chart Type Toggles */}
              <div className="flex flex-wrap items-center gap-3">
                {hasEvaluatedData && filteredChartData.length > 0 && (
                  <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
                    <span className="text-text-muted">
                      Avg: <strong className="text-text-primary">{chartSummary.avg}%</strong>
                    </span>
                    <span className="text-text-muted">
                      Peak: <strong className="text-emerald-600 dark:text-[#C7F36B]">{chartSummary.peak}%</strong>
                    </span>
                    <span className="text-text-muted">
                      Latest: <strong className="text-[#FF6B35]">{chartSummary.latest}%</strong>
                    </span>
                  </div>
                )}

                <div className="inline-flex rounded-[8px] bg-bg-canvas border border-border-subtle p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartType('area')}
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                      chartType === 'area'
                        ? 'bg-[#151515] text-white'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Trend
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('bar')}
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                      chartType === 'bar'
                        ? 'bg-[#151515] text-white'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Bars
                  </button>
                </div>
              </div>
            </div>

            {/* Chart Canvas or Intentional Empty State */}
            <div className="h-64 sm:h-72 w-full">
              {filteredChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart
                      data={filteredChartData}
                      margin={{ top: 10, right: 16, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="evalixScoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#FF6B35" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--chart-grid, #DFD8CC)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="var(--text-secondary, #52504C)"
                        fontSize={11}
                        tickMargin={8}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--text-secondary, #52504C)"
                        fontSize={11}
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReferenceLine
                        y={80}
                        stroke="#1F8A4C"
                        strokeDasharray="4 4"
                        label={{
                          value: '80% Target',
                          position: 'insideTopRight',
                          fill: '#1F8A4C',
                          fontSize: 10,
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-[10px] bg-[#151515] text-[#F8F5EF] border border-[#333333] p-3 shadow-lg text-xs font-mono space-y-1">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[#C7F36B] font-bold">{d.modeLabel}</span>
                                <span className="text-[#B5AFA6]">{d.name}</span>
                              </div>
                              <div className="font-display font-bold text-white text-sm truncate max-w-[200px]">
                                {d.role}
                              </div>
                              <div className="text-base font-bold text-[#FF6B35]">
                                Score: {d.score}%
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#FF6B35"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#evalixScoreGradient)"
                        dot={{
                          fill: '#151515',
                          stroke: '#FF6B35',
                          strokeWidth: 2,
                          r: 4,
                        }}
                        activeDot={{ r: 6, fill: '#C7F36B', stroke: '#151515' }}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart
                      data={filteredChartData}
                      margin={{ top: 10, right: 16, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--chart-grid, #DFD8CC)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="var(--text-secondary, #52504C)"
                        fontSize={11}
                        tickMargin={8}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--text-secondary, #52504C)"
                        fontSize={11}
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReferenceLine y={80} stroke="#1F8A4C" strokeDasharray="4 4" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-[10px] bg-[#151515] text-[#F8F5EF] border border-[#333333] p-3 shadow-lg text-xs font-mono space-y-1">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[#C7F36B] font-bold">{d.modeLabel}</span>
                                <span className="text-[#B5AFA6]">{d.name}</span>
                              </div>
                              <div className="font-display font-bold text-white text-sm truncate max-w-[200px]">
                                {d.role}
                              </div>
                              <div className="text-base font-bold text-[#FF6B35]">
                                Score: {d.score}%
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={36}>
                        {filteredChartData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={
                              entry.score >= 80
                                ? '#1F8A4C'
                                : entry.score >= 60
                                ? '#FF6B35'
                                : '#8174FF'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                /* Editorial Intentional Empty State (No broken empty graph) */
                <div className="relative w-full h-full rounded-[16px] bg-bg-canvas border border-dashed border-border-subtle p-6 flex flex-col items-center justify-center text-center overflow-hidden">
                  {/* Subtle Blueprint Ghost Preview in the background */}
                  <div className="absolute inset-0 opacity-15 pointer-events-none p-4 flex items-end">
                    <ResponsiveContainer width="100%" height="80%">
                      <AreaChart data={GHOST_CHART_PREVIEW}>
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#7C7872"
                          strokeDasharray="3 3"
                          fill="transparent"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="relative z-10 max-w-sm space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-bg-surface border border-border-subtle text-[10px] font-mono uppercase tracking-wider text-text-muted">
                      <span>CHART PREVIEW</span>
                    </div>

                    <h3 className="text-lg font-display font-bold text-text-primary tracking-tight">
                      Your first score starts here.
                    </h3>

                    <p className="text-xs text-text-secondary leading-relaxed">
                      Complete a practice session to unlock your performance trends, velocity curve, and score delta tracking.
                    </p>

                    <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/live-interview', {
                            state: { jobRole: selectedPreset.role, skills: selectedPreset.skills },
                          })
                        }
                        className="px-3.5 py-1.5 rounded-[9px] bg-[#FF6B35] hover:bg-[#EB5822] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        Start First Interview <FiArrowUpRight size={13} />
                      </button>
                      {activeFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setActiveFilter('all')}
                          className="px-3 py-1.5 rounded-[9px] bg-bg-surface border border-border-subtle text-xs font-mono font-semibold text-text-primary hover:bg-surface-hover cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Competency & Mode Breakdown */}
        <div className="lg:col-span-4 rounded-[20px] bg-bg-surface border border-border-subtle p-5 sm:p-6 flex flex-col justify-between">
          <div>
            {/* Header with Tab Switcher */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-border-subtle">
              <span className="text-sm font-display font-bold text-text-primary">
                Competency Breakdown
              </span>
              <div className="inline-flex rounded-[8px] bg-bg-canvas border border-border-subtle p-0.5">
                <button
                  type="button"
                  onClick={() => setRightTab('topics')}
                  className={`px-2.5 py-1 rounded-[6px] text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                    rightTab === 'topics'
                      ? 'bg-[#151515] text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  By Topic
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('modes')}
                  className={`px-2.5 py-1 rounded-[6px] text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                    rightTab === 'modes'
                      ? 'bg-[#151515] text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  By Mode
                </button>
              </div>
            </div>

            {/* Tab 1: By Topic */}
            {rightTab === 'topics' ? (
              isAssessed ? (
                <div className="space-y-3">
                  {topicPerformance.map((item, idx) => {
                    const target = item.target || 80;
                    const diff = item.score - target;
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-[12px] bg-bg-canvas border border-border-subtle space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-display font-bold text-text-primary">
                            {item.topic}
                          </span>
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                diff >= 0
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-[#C7F36B]'
                                  : 'bg-[#FF6B35]/15 text-[#FF6B35]'
                              }`}
                            >
                              {diff >= 0 ? `+${diff}%` : `${diff}%`} vs {target}%
                            </span>
                            <strong className="text-text-primary">{item.score}%</strong>
                          </div>
                        </div>
                        <div className="w-full bg-bg-elevated rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(6, item.score))}%`,
                              backgroundColor: item.score >= target ? '#1F8A4C' : '#FF6B35',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 px-4 rounded-[14px] bg-bg-canvas border border-dashed border-border-subtle text-center space-y-2">
                  <p className="text-xs font-display font-bold text-text-primary">
                    Your skill breakdown will appear here.
                  </p>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Complete your first evaluation to see topic strengths, gaps, and targeted practice recommendations.
                  </p>
                </div>
              )
            ) : (
              /* Tab 2: By Mode */
              <div className="space-y-2.5">
                {modeBreakdown.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setActiveFilter(m.key)}
                    className={`w-full text-left p-3 rounded-[12px] border transition-all cursor-pointer ${
                      activeFilter === m.key
                        ? 'bg-[#151515] text-white border-[#151515]'
                        : 'bg-bg-canvas border-border-subtle hover:border-text-primary'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-display font-bold text-xs">{m.mode}</span>
                      <span className="font-mono font-bold text-xs text-[#FF6B35]">
                        {m.avgScore}% Avg
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
                      <span>{m.total} Total Runs</span>
                      <span>{m.completed} Evaluated</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 mt-4 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-text-secondary">
            <span>Target Benchmark: 80%</span>
            <Link to="/mcq-generator" className="text-[#FF6B35] font-bold hover:underline">
              Boost Weakest Topic &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 4. Practice & Prep Modules (Two Distinct Hierarchies) ─── */}
      <section className="dash-section space-y-4">
        {/* GROUP A: INTERVIEW PRACTICE */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-mono uppercase tracking-[0.16em] font-bold text-text-muted">
              GROUP A &bull; INTERVIEW PRACTICE
            </h2>
            <span className="text-xs font-mono text-text-secondary">
              Active Track: <strong className="text-text-primary">{selectedPreset.label}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Primary Featured Module: Live Voice Interview (6 cols) */}
            <div className="lg:col-span-6 rounded-[20px] bg-bg-surface border-2 border-[#151515] dark:border-[#FF6B35]/40 p-5 sm:p-6 flex flex-col justify-between space-y-5 hover:shadow-sm transition-all group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-[6px] bg-[#FF6B35]/15 text-[#FF6B35] font-mono text-[10px] font-bold uppercase tracking-wider">
                    FEATURED INTERVIEW
                  </span>
                  <span className="text-xs font-mono text-text-muted">
                    {stats?.totalLiveInterviews || 0} runs &bull; {stats?.avgLiveScore || 0}% avg
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-display font-bold text-text-primary group-hover:text-[#FF6B35] transition-colors">
                    Live Voice Interview
                  </h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    Conversational adaptive voice practice with Shristi AI. Dynamic follow-ups testing technical depth and communication clarity.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Shristi AI', '3–10 Questions', 'Follow-up Probing', 'Voice + Text'].map((spec) => (
                    <span
                      key={spec}
                      className="px-2 py-0.5 rounded-[6px] bg-bg-canvas border border-border-subtle text-[11px] font-mono font-semibold text-text-primary"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                <span className="font-mono text-xs text-text-muted">
                  Calibrated for {selectedPreset.role}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    navigate('/live-interview', {
                      state: { jobRole: selectedPreset.role, skills: selectedPreset.skills },
                    })
                  }
                  className="px-4 py-2 rounded-[9px] bg-[#FF6B35] hover:bg-[#EB5822] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  Start Voice <FiArrowUpRight size={13} />
                </button>
              </div>
            </div>

            {/* Secondary Module 1: Mock Simulator (3 cols) */}
            <div className="lg:col-span-3 rounded-[20px] bg-bg-surface border border-border-subtle p-5 flex flex-col justify-between space-y-4 hover:border-text-primary transition-all group">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-bg-canvas border border-border-subtle text-[10px] font-mono font-bold text-text-muted uppercase">
                    3-PILLAR RUBRIC
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {stats?.totalStructuredMocks || 0} runs
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-display font-bold text-text-primary group-hover:text-[#FF6B35] transition-colors">
                    Mock Simulator
                  </h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    Structured interview rounds evaluated across 3 rubrics with 0–10 scoring.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {['3, 5, 8 Qs', 'Rubric Grading', 'Audio / Text'].map((spec) => (
                    <span
                      key={spec}
                      className="px-1.5 py-0.5 rounded bg-bg-canvas border border-border-subtle text-[10px] font-mono text-text-secondary"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate('/mock-interview', { state: { jobRole: selectedPreset.role } })
                }
                className="w-full py-2 px-3 rounded-[9px] bg-bg-canvas hover:bg-surface-hover border border-border-subtle text-xs font-mono font-bold text-text-primary flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>Launch Simulator</span>
                <FiArrowRight size={12} />
              </button>
            </div>

            {/* Secondary Module 2: Timed MCQ Test (3 cols) */}
            <div className="lg:col-span-3 rounded-[20px] bg-bg-surface border border-border-subtle p-5 flex flex-col justify-between space-y-4 hover:border-text-primary transition-all group">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-bg-canvas border border-border-subtle text-[10px] font-mono font-bold text-[#8174FF] uppercase">
                    AUTO-TIMER
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {stats?.totalAssessments || 0} tests
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-display font-bold text-text-primary group-hover:text-[#FF6B35] transition-colors">
                    Timed MCQ Test
                  </h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    Rapid 90-second technical questions with automatic scoring and explanations.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {['10–30 MCQs', 'Auto-Timer', 'Answer Key'].map((spec) => (
                    <span
                      key={spec}
                      className="px-1.5 py-0.5 rounded bg-bg-canvas border border-border-subtle text-[10px] font-mono text-text-secondary"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate('/mcq-generator', {
                    state: { jobRole: selectedPreset.role, skills: selectedPreset.skills },
                  })
                }
                className="w-full py-2 px-3 rounded-[9px] bg-bg-canvas hover:bg-surface-hover border border-border-subtle text-xs font-mono font-bold text-text-primary flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>Start Test</span>
                <FiArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* GROUP B: PREPARATION TOOLS */}
        <div className="space-y-3 pt-3">
          <h2 className="text-xs font-mono uppercase tracking-[0.16em] font-bold text-text-muted">
            GROUP B &bull; PREPARATION TOOLS
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tool 1: ATS Resume Match */}
            <div className="rounded-[16px] bg-bg-surface border border-border-subtle p-4 flex flex-col justify-between space-y-3 hover:border-text-primary transition-colors group">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-[8px] bg-bg-canvas border border-border-subtle flex items-center justify-center text-text-primary">
                    <FiFileText size={14} />
                  </div>
                  <span className="font-mono text-[10px] text-text-muted">PDF &le; 5MB</span>
                </div>
                <h3 className="text-sm font-display font-bold text-text-primary group-hover:text-[#FF6B35] transition-colors">
                  ATS Resume Match
                </h3>
                <p className="text-xs text-text-secondary leading-snug">
                  Keyword gap scan comparing your resume against targeted role job descriptions.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/resume-analyzer')}
                className="w-full pt-2 border-t border-border-subtle flex items-center justify-between text-xs font-mono font-bold text-[#FF6B35] hover:underline cursor-pointer"
              >
                <span>Scan Resume</span>
                <FiArrowRight size={12} />
              </button>
            </div>

            {/* Tool 2: JD Study Roadmap */}
            <div className="rounded-[16px] bg-bg-surface border border-border-subtle p-4 flex flex-col justify-between space-y-3 hover:border-text-primary transition-colors group">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-[8px] bg-bg-canvas border border-border-subtle flex items-center justify-center text-text-primary">
                    <FiBriefcase size={14} />
                  </div>
                  <span className="font-mono text-[10px] text-text-muted">
                    {stats?.totalAnalyses || 0} saved
                  </span>
                </div>
                <h3 className="text-sm font-display font-bold text-text-primary group-hover:text-[#FF6B35] transition-colors">
                  JD Study Roadmap
                </h3>
                <p className="text-xs text-text-secondary leading-snug">
                  Break down real job postings into a weekly preparation roadmap and priority skills.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/job-analysis')}
                className="w-full pt-2 border-t border-border-subtle flex items-center justify-between text-xs font-mono font-bold text-[#FF6B35] hover:underline cursor-pointer"
              >
                <span>Build Roadmap</span>
                <FiArrowRight size={12} />
              </button>
            </div>

            {/* Tool 3: Question Bank */}
            <div className="rounded-[16px] bg-bg-surface border border-border-subtle p-4 flex flex-col justify-between space-y-3 hover:border-text-primary transition-colors group">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-[8px] bg-bg-canvas border border-border-subtle flex items-center justify-center text-text-primary">
                    <FiTool size={14} />
                  </div>
                  <span className="font-mono text-[10px] text-text-muted">PDF Export</span>
                </div>
                <h3 className="text-sm font-display font-bold text-text-primary group-hover:text-[#FF6B35] transition-colors">
                  Question Bank
                </h3>
                <p className="text-xs text-text-secondary leading-snug">
                  Curated interview questions with model answers, core points, and pitfalls.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate('/interview-questions', {
                    state: { jobRole: selectedPreset.role, skills: selectedPreset.skills },
                  })
                }
                className="w-full pt-2 border-t border-border-subtle flex items-center justify-between text-xs font-mono font-bold text-[#FF6B35] hover:underline cursor-pointer"
              >
                <span>Explore Questions</span>
                <FiArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. Recent Activity Session Workbench ─── */}
      <section className="dash-section rounded-[20px] bg-bg-surface border border-border-subtle overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-4 sm:p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-display font-bold text-text-primary mr-2">
              Recent Activity
            </span>
            {[
              { id: 'all', label: 'All' },
              { id: 'live_interview', label: 'Voice' },
              { id: 'mock_interview', label: 'Mock' },
              { id: 'assessment', label: 'MCQ' },
              { id: 'job_analysis', label: 'JD' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-2.5 py-1 rounded-[7px] text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-[#151515] text-white'
                    : 'bg-bg-canvas text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by role..."
                className="pl-8 pr-3 py-1 rounded-[8px] bg-bg-canvas border border-border-subtle text-xs font-mono text-text-primary placeholder-text-muted focus:border-[#FF6B35] focus:outline-none w-40 sm:w-48"
              />
            </div>
            <Link
              to="/history"
              className="text-xs font-mono font-bold text-[#FF6B35] hover:underline shrink-0"
            >
              All ({recentActivity?.length || 0}) &rarr;
            </Link>
          </div>
        </div>

        {/* Scored Activity Rows or Intentional Empty State */}
        {filteredActivities.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-canvas text-[11px] font-mono uppercase text-text-muted">
                  <th className="py-2.5 px-4 w-28">Mode</th>
                  <th className="py-2.5 px-4">Role / Track</th>
                  <th className="py-2.5 px-4 w-32">Date</th>
                  <th className="py-2.5 px-4 w-44">Score</th>
                  <th className="py-2.5 px-4 w-20 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs sm:text-sm">
                {filteredActivities.slice(0, 7).map((activity, idx) => {
                  const badge = getModeBadge(activity.type);
                  const hasScore = activity.score !== undefined && activity.score !== null;
                  return (
                    <tr
                      key={activity.id || idx}
                      onClick={() => navigate(getActivityLink(activity))}
                      className="hover:bg-bg-canvas/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-display font-bold text-text-primary group-hover:text-[#FF6B35] transition-colors">
                        {activity.role || activity.title}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-text-secondary">
                        {formatDate(activity.date)}
                      </td>
                      <td className="py-3 px-4">
                        {hasScore ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-20 h-1.5 rounded-full bg-border-subtle overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.max(6, activity.score))}%`,
                                  backgroundColor:
                                    activity.score >= 80
                                      ? '#1F8A4C'
                                      : activity.score >= 60
                                      ? '#FF6B35'
                                      : '#EF4444',
                                }}
                              />
                            </div>
                            <span className="font-mono font-bold text-xs text-text-primary">
                              {activity.score}%
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-text-muted capitalize">
                            {activity.status || 'Saved'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-bold text-[#FF6B35]">
                        Open &rarr;
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-4 text-center space-y-2">
            <p className="text-sm font-display font-bold text-text-primary">
              Nothing here yet.
            </p>
            <p className="text-xs text-text-secondary">
              Your completed practice sessions will show up here.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() =>
                  navigate('/live-interview', {
                    state: { jobRole: selectedPreset.role, skills: selectedPreset.skills },
                  })
                }
                className="px-3.5 py-1.5 rounded-[9px] bg-[#FF6B35] hover:bg-[#EB5822] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                Start Practicing <FiArrowUpRight size={13} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
