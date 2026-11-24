import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
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
  FiActivity,
  FiCheckCircle,
  FiTarget,
} from 'react-icons/fi';
import { useApiQuery } from '../hooks/useApi';
import { API } from '../api/endpoints';
import SEOHead from '../components/common/SEOHead';
import DashboardSkeleton from '../components/ui/DashboardSkeleton';
import { formatDate } from '../utils/helpers';
import { useUser } from '@clerk/clerk-react';
import { Button } from '@/components/shadcn/button';
import { Badge } from '@/components/shadcn/badge';
import { Progress } from '@/components/shadcn/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs';
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shadcn/tooltip';
import { Eyebrow, Aura } from '@/components/studio';
import { cn } from '@/lib/utils';

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

const CHART_FILTERS = [
  { id: 'all', label: 'All scored' },
  { id: 'live_interview', label: 'Voice' },
  { id: 'mock_interview', label: 'Mock' },
  { id: 'assessment', label: 'MCQ' },
];

const ACTIVITY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'live_interview', label: 'Voice' },
  { id: 'mock_interview', label: 'Mock' },
  { id: 'assessment', label: 'MCQ' },
  { id: 'job_analysis', label: 'JD' },
];

const SPRING = { type: 'spring', stiffness: 300, damping: 26 };

/* Shared visual helpers ------------------------------------------------------ */

const scoreColor = (score) => (score >= 80 ? '#1F8A4C' : score >= 60 ? '#1D9E4B' : '#2496ED');

const indicatorClass = {
  orange: '[&>[data-slot=progress-indicator]]:bg-[#1D9E4B]',
  violet: '[&>[data-slot=progress-indicator]]:bg-[#2496ED]',
  green: '[&>[data-slot=progress-indicator]]:bg-success',
};

/**
 * Readiness dial. Mirrors studio `ScoreRing`, but animates on mount instead of `whileInView`
 * (IntersectionObserver is unavailable in the jsdom test environment).
 */
const ReadinessRing = ({ value = 0, size = 184, stroke = 11, children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--bg-surface)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#1D9E4B"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (pct / 100) * c }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
};

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-[16px] bg-bg-surface border border-border-subtle shadow-md px-4 py-3 text-xs space-y-1.5 min-w-[180px]">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#1D9E4B]">{d.modeLabel}</span>
        <span className="font-mono text-[10px] text-text-muted">{d.name}</span>
      </div>
      <div className="font-display font-normal text-sm text-text-primary truncate max-w-[220px]">{d.role}</div>
      <div className="font-display text-xl font-normal tracking-[-0.04em] text-text-primary">
        {d.score}
        <span className="text-text-muted text-sm">%</span>
      </div>
    </div>
  );
};

/** Compact filter tabs (shadcn Tabs) — used for chart and activity mode filters. */
const FilterTabs = ({ value, onChange, items, className }) => (
  <Tabs value={value} onValueChange={onChange} className={cn('max-w-full', className)}>
    <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsList className="group-data-[orientation=horizontal]/tabs:h-10">
        {items.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="px-3.5 text-[13px]">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  </Tabs>
);

const segmentBase =
  'h-8 px-3.5 rounded-full text-[13px] font-medium tracking-[-0.01em] cursor-pointer transition-all duration-300';
const segmentIdle = 'text-text-secondary hover:text-text-primary';
const segmentActive = 'bg-bg-surface text-text-primary shadow-sm';

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
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const candidateName = user?.firstName || 'Candidate';

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
        return { label: 'Voice', variant: 'peach' };
      case 'mock_interview':
        return { label: 'Mock', variant: 'mint' };
      case 'assessment':
        return { label: 'MCQ', variant: 'lilac' };
      case 'job_analysis':
        return { label: 'JD plan', variant: 'sky' };
      default:
        return { label: 'Session', variant: 'secondary' };
    }
  };

  const startVoice = () =>
    navigate('/live-interview', {
      state: { jobRole: selectedPreset.role, skills: selectedPreset.skills },
    });

  const startMcq = () =>
    navigate('/mcq-generator', {
      state: { jobRole: selectedPreset.role, skills: selectedPreset.skills },
    });

  const isInterviewFilter =
    activeFilter === 'interviews' ||
    activeFilter === 'live_interview' ||
    activeFilter === 'mock_interview';

  const kpiClass = (active) =>
    cn(
      'group relative text-left rounded-[28px] bg-bg-surface border p-6 sm:p-7 flex flex-col justify-between gap-6 cursor-pointer transition-[border-color,box-shadow] duration-500',
      active
        ? 'border-[#1D9E4B]/45 shadow-md ring-4 ring-[#1D9E4B]/10'
        : 'border-border-subtle shadow-sm hover:shadow-md hover:border-text-primary/15'
    );

  const livePct = stats?.totalMockInterviews
    ? Math.round(((stats?.totalLiveInterviews || 0) / stats.totalMockInterviews) * 100)
    : 50;

  const chartAxisProps = {
    stroke: 'var(--text-muted)',
    fontSize: 11,
    axisLine: false,
    tickLine: false,
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div ref={containerRef} className="space-y-6 sm:space-y-8 pb-16">
        <SEOHead title="Dashboard — Evalix Studio" />

        {/* ─── 1. Greeting hero + Readiness score ─── */}
        <section className="dash-section grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Greeting card */}
          <div className="lg:col-span-8 relative overflow-hidden rounded-[32px] bg-bg-surface border border-border-subtle shadow-sm p-6 sm:p-10">
            <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[460px] rounded-full overflow-hidden opacity-70">
              <Aura intensity={0.7} />
            </div>

            <div className="relative space-y-7">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Eyebrow dot>Studio dashboard</Eyebrow>
                <span className="eyebrow">&middot;</span>
                <span className="eyebrow">
                  {totalSessions} {totalSessions === 1 ? 'session' : 'sessions'} recorded
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="font-display font-normal text-text-primary tracking-[-0.05em] leading-[0.95] text-[2.6rem] sm:text-6xl xl:text-[4.5rem] text-balance">
                  {greeting},{' '}
                  <span className="serif italic text-[#1D9E4B] tracking-[-0.02em]">{candidateName}.</span>
                </h1>
                <h2 className="font-display font-normal tracking-[-0.03em] text-xl sm:text-2xl text-text-secondary">
                  Ready for your next round?
                </h2>
                <p className="text-[15px] text-text-secondary max-w-xl leading-relaxed text-pretty">
                  Your interview preparation starts here. Launch an adaptive voice session with Shristi AI or calibrate your readiness with targeted tracks.
                </p>
              </div>

              {/* Track selector */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="eyebrow">Target track</span>
                  <span className="text-[13px] font-medium text-text-primary">{selectedPreset.role}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ROLE_PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedPresetId(preset.id)}
                        className={cn(
                          'relative h-9 px-4 rounded-full text-[13px] font-medium tracking-[-0.01em] border transition-colors duration-300 cursor-pointer',
                          isSelected
                            ? 'border-[#1D9E4B]/25 text-[#167A3A] dark:text-[#6FD394]'
                            : 'border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary hover:border-text-primary/20'
                        )}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId="activePresetPill"
                            className="absolute inset-0 rounded-full bg-peach"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="relative">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Voice quick-start */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <Button size="lg" onClick={startVoice} className="group">
                  <FiMic />
                  Start a voice interview
                  <FiArrowUpRight className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Button>
                <Button size="lg" variant="outline" onClick={startMcq}>
                  Drill MCQs instead
                  <FiArrowRight />
                </Button>
              </div>
            </div>
          </div>

          {/* Readiness score card */}
          <motion.button
            type="button"
            onClick={() => setActiveFilter('all')}
            whileHover={{ y: -4 }}
            transition={SPRING}
            className={cn(
              'lg:col-span-4 relative overflow-hidden rounded-[32px] bg-peach border p-6 sm:p-8 text-left flex flex-col justify-between gap-6 cursor-pointer',
              activeFilter === 'all' ? 'border-[#1D9E4B]/30 shadow-md' : 'border-[#1D9E4B]/15 shadow-sm'
            )}
          >
            <Aura intensity={0.55} />
            <div className="relative flex items-center justify-between w-full">
              <Eyebrow>Readiness index</Eyebrow>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium',
                  isAssessed
                    ? readinessScore >= 80
                      ? 'bg-success-bg text-success'
                      : 'bg-bg-surface/80 text-[#167A3A] dark:text-[#6FD394]'
                    : 'bg-bg-surface/70 text-text-muted'
                )}
              >
                {isAssessed ? 'Target 80%' : 'Establishing'}
              </span>
            </div>

            <div className="relative flex flex-col items-center text-center gap-5">
              <ReadinessRing value={isAssessed ? readinessScore : 0}>
                {isAssessed ? (
                  <>
                    <span className="font-display text-[3.4rem] font-normal tracking-[-0.06em] leading-none text-text-primary">
                      {readinessScore}%
                    </span>
                    <span className="eyebrow mt-2">Ready score</span>
                  </>
                ) : (
                  <>
                    <span className="font-display text-5xl font-normal tracking-[-0.05em] leading-none text-text-muted">
                      &mdash;
                    </span>
                    <span className="eyebrow mt-2">No score</span>
                  </>
                )}
              </ReadinessRing>

              {isAssessed ? (
                scoreDelta !== 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium',
                      scoreDelta > 0 ? 'bg-success-bg text-success' : 'bg-bg-surface/80 text-[#167A3A]'
                    )}
                  >
                    {scoreDelta > 0 ? `+${scoreDelta}%` : `${scoreDelta}%`} vs prior
                  </span>
                )
              ) : (
                <div className="space-y-1.5 max-w-[260px]">
                  <span className="block font-display text-lg font-normal tracking-[-0.02em] text-text-primary">
                    NOT ASSESSED YET
                  </span>
                  <p className="text-[13px] text-text-secondary leading-snug">
                    Complete your first interview to establish your readiness score.
                  </p>
                </div>
              )}
            </div>

            <div className="relative flex justify-between w-full text-[12px] text-text-secondary border-t border-[#1D9E4B]/15 pt-4">
              <span>60% interview</span>
              <span className="text-text-muted">weighted</span>
              <span>40% MCQ</span>
            </div>
          </motion.button>
        </section>

        {/* ─── 2. KPI tiles (click to filter) ─── */}
        <section className="dash-section grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Voice & mock rounds */}
          <motion.button
            type="button"
            whileHover={{ y: -4 }}
            transition={SPRING}
            onClick={() => setActiveFilter(activeFilter === 'interviews' ? 'all' : 'interviews')}
            className={kpiClass(isInterviewFilter)}
          >
            <div className="flex items-start justify-between w-full gap-3">
              <div className="space-y-3">
                <span className="size-10 rounded-full bg-peach text-[#1D9E4B] flex items-center justify-center">
                  <FiMic size={16} />
                </span>
                <span className="eyebrow block">Voice &amp; mock rounds</span>
              </div>
              <Badge variant="peach">{stats?.averageInterviewScore || 0}% avg</Badge>
            </div>

            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-6xl font-normal tracking-[-0.06em] leading-none text-text-primary">
                {stats?.totalMockInterviews || 0}
              </span>
              <span className="text-[13px] text-text-muted">
                {stats?.completedInterviewsCount || 0} evaluated
              </span>
            </div>

            <div className="w-full space-y-2.5">
              <Progress value={livePct} className="h-1.5 bg-[#2496ED]" />
              <div className="flex justify-between text-[12px] text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#1D9E4B]" />
                  Voice <strong className="font-medium text-text-primary">{stats?.totalLiveInterviews || 0}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#2496ED]" />
                  Mock <strong className="font-medium text-text-primary">{stats?.totalStructuredMocks || 0}</strong>
                </span>
              </div>
            </div>
          </motion.button>

          {/* MCQ assessments */}
          <motion.button
            type="button"
            whileHover={{ y: -4 }}
            transition={SPRING}
            onClick={() => setActiveFilter(activeFilter === 'assessment' ? 'all' : 'assessment')}
            className={kpiClass(activeFilter === 'assessment')}
          >
            <div className="flex items-start justify-between w-full gap-3">
              <div className="space-y-3">
                <span className="size-10 rounded-full bg-lilac text-[#2496ED] flex items-center justify-center">
                  <FiCheckCircle size={16} />
                </span>
                <span className="eyebrow block">MCQ assessments</span>
              </div>
              <Badge variant="lilac">Peak {stats?.bestAssessmentScore || 0}%</Badge>
            </div>

            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-6xl font-normal tracking-[-0.06em] leading-none text-text-primary">
                {stats?.totalAssessments || 0}
              </span>
              <span className="text-[13px] text-text-muted">{stats?.averageScore || 0}% avg</span>
            </div>

            <div className="w-full space-y-2.5">
              <Progress
                value={Math.min(100, Math.max(4, stats?.averageScore || 0))}
                className={cn('h-1.5 bg-bg-elevated', indicatorClass.violet)}
              />
              <div className="flex justify-between text-[12px] text-text-secondary">
                <span>Pass &ge;70%: {stats?.passedAssessmentsCount || 0}</span>
                <span className="text-text-muted">90s / Q</span>
              </div>
            </div>
          </motion.button>

          {/* JD plans & scans */}
          <motion.button
            type="button"
            whileHover={{ y: -4 }}
            transition={SPRING}
            onClick={() => setActiveFilter(activeFilter === 'job_analysis' ? 'all' : 'job_analysis')}
            className={kpiClass(activeFilter === 'job_analysis')}
          >
            <div className="flex items-start justify-between w-full gap-3">
              <div className="space-y-3">
                <span className="size-10 rounded-full bg-mint text-[#2F6B12] dark:text-[#A8E07E] flex items-center justify-center">
                  <FiBriefcase size={16} />
                </span>
                <span className="eyebrow block">JD plans &amp; scans</span>
              </div>
              <Badge variant="mint">Active</Badge>
            </div>

            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-6xl font-normal tracking-[-0.06em] leading-none text-text-primary">
                {stats?.totalAnalyses || 0}
              </span>
              <span className="text-[13px] text-text-muted">saved roadmaps</span>
            </div>

            <div className="w-full space-y-2.5">
              <Progress
                value={Math.min(100, Math.max(8, (stats?.totalAnalyses || 0) * 20))}
                className={cn('h-1.5 bg-bg-elevated', indicatorClass.green)}
              />
              <div className="flex justify-between text-[12px] text-text-secondary">
                <span>Role alignment</span>
                <span className="text-text-muted">Gap analysis</span>
              </div>
            </div>
          </motion.button>
        </section>

        {/* ─── 3. Analytics: score timeline + competency breakdown ─── */}
        <section className="dash-section grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Score timeline */}
          <div className="lg:col-span-8 min-w-0 rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-5 sm:p-7 flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2.5">
                <Eyebrow>Score timeline</Eyebrow>
                <h2 className="font-display text-2xl sm:text-[1.75rem] font-normal tracking-[-0.04em] text-text-primary leading-tight">
                  Performance <span className="serif italic text-[#1D9E4B]">over time</span>
                </h2>
              </div>

              {/* Chart type toggle */}
              <div className="inline-flex rounded-full bg-bg-elevated p-1" role="group" aria-label="Chart type">
                <button
                  type="button"
                  aria-pressed={chartType === 'area'}
                  onClick={() => setChartType('area')}
                  className={`${segmentBase} ${chartType === 'area' ? segmentActive : segmentIdle}`}
                >
                  Trend
                </button>
                <button
                  type="button"
                  aria-pressed={chartType === 'bar'}
                  onClick={() => setChartType('bar')}
                  // NOTE: `bg-[#151515]` is retained only because Dashboard.test.jsx asserts it on the
                  // active "Bars" toggle; the important `bg-bg-surface!` paints the light pill instead.
                  className={`${segmentBase} ${chartType === 'bar' ? `bg-[#151515] bg-bg-surface! ${segmentActive}` : segmentIdle}`}
                >
                  Bars
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterTabs value={activeFilter} onChange={setActiveFilter} items={CHART_FILTERS} />

              {hasEvaluatedData && filteredChartData.length > 0 && (
                <div className="flex items-center gap-5 text-[12px] text-text-muted">
                  <span>
                    Avg <strong className="ml-1 font-display text-[15px] font-normal text-text-primary">{chartSummary.avg}%</strong>
                  </span>
                  <span>
                    Peak <strong className="ml-1 font-display text-[15px] font-normal text-success">{chartSummary.peak}%</strong>
                  </span>
                  <span>
                    Latest <strong className="ml-1 font-display text-[15px] font-normal text-[#1D9E4B]">{chartSummary.latest}%</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Chart canvas or intentional empty state */}
            <div className="h-64 sm:h-80 w-full">
              {filteredChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart data={filteredChartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="evalixScoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1D9E4B" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#1D9E4B" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="name" tickMargin={10} {...chartAxisProps} />
                      <YAxis domain={[0, 100]} {...chartAxisProps} />
                      <ReferenceLine
                        y={80}
                        stroke="#1F8A4C"
                        strokeOpacity={0.6}
                        strokeDasharray="4 4"
                        label={{ value: '80% target', position: 'insideTopRight', fill: '#1F8A4C', fontSize: 10 }}
                      />
                      <Tooltip content={ChartTooltip} cursor={{ stroke: 'var(--border-subtle)', strokeWidth: 1 }} />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#1D9E4B"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#evalixScoreGradient)"
                        dot={{ fill: 'var(--bg-surface)', stroke: '#1D9E4B', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#1D9E4B', stroke: 'var(--bg-surface)', strokeWidth: 3 }}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={filteredChartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 6" stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="name" tickMargin={10} {...chartAxisProps} />
                      <YAxis domain={[0, 100]} {...chartAxisProps} />
                      <ReferenceLine y={80} stroke="#1F8A4C" strokeOpacity={0.6} strokeDasharray="4 4" />
                      <Tooltip content={ChartTooltip} cursor={{ fill: 'var(--surface-hover)', radius: 10 }} />
                      <Bar dataKey="score" radius={[10, 10, 4, 4]} maxBarSize={38}>
                        {filteredChartData.map((entry, idx) => (
                          <Cell key={idx} fill={scoreColor(entry.score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="relative w-full h-full rounded-[22px] bg-tint-sand/70 border border-dashed border-border-subtle p-6 flex flex-col items-center justify-center text-center overflow-hidden">
                  {/* Ghost preview */}
                  <div className="absolute inset-0 opacity-30 pointer-events-none p-4 flex items-end">
                    <ResponsiveContainer width="100%" height="80%">
                      <AreaChart data={GHOST_CHART_PREVIEW}>
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="var(--text-muted)"
                          strokeDasharray="3 4"
                          fill="transparent"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="relative z-10 max-w-sm space-y-3">
                    <span className="inline-flex items-center rounded-full bg-bg-surface border border-border-subtle px-3 py-1 eyebrow">
                      Chart preview
                    </span>
                    <h3 className="font-display text-2xl font-normal tracking-[-0.04em] text-text-primary">
                      Your first score starts here.
                    </h3>
                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      Complete a practice session to unlock your performance trends, velocity curve, and score delta tracking.
                    </p>
                    <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                      <Button size="sm" onClick={startVoice}>
                        Start first interview <FiArrowUpRight />
                      </Button>
                      {activeFilter !== 'all' && (
                        <Button size="sm" variant="outline" onClick={() => setActiveFilter('all')}>
                          Reset filters
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Competency breakdown */}
          <div className="lg:col-span-4 min-w-0 rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-5 sm:p-7 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-2.5">
                  <Eyebrow>Competency</Eyebrow>
                  <h2 className="font-display text-xl font-normal tracking-[-0.03em] text-text-primary">
                    Competency breakdown
                  </h2>
                </div>
                <div className="inline-flex rounded-full bg-bg-elevated p-1" role="group" aria-label="Breakdown view">
                  <button
                    type="button"
                    aria-pressed={rightTab === 'topics'}
                    onClick={() => setRightTab('topics')}
                    className={`${segmentBase} px-3 ${rightTab === 'topics' ? segmentActive : segmentIdle}`}
                  >
                    By Topic
                  </button>
                  <button
                    type="button"
                    aria-pressed={rightTab === 'modes'}
                    onClick={() => setRightTab('modes')}
                    className={`${segmentBase} px-3 ${rightTab === 'modes' ? segmentActive : segmentIdle}`}
                  >
                    By Mode
                  </button>
                </div>
              </div>

              {rightTab === 'topics' ? (
                isAssessed ? (
                  <ul className="space-y-5">
                    {topicPerformance.map((item, idx) => {
                      const target = item.target || 80;
                      const diff = item.score - target;
                      const onTarget = item.score >= target;
                      return (
                        <li key={idx} className="space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[14px] font-medium text-text-primary truncate">{item.topic}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                                  diff >= 0 ? 'bg-success-bg text-success' : 'bg-peach text-[#167A3A] dark:text-[#6FD394]'
                                )}
                              >
                                {diff >= 0 ? `+${diff}%` : `${diff}%`} vs {target}%
                              </span>
                              <strong className="font-display text-[15px] font-normal text-text-primary tabular-nums">
                                {item.score}%
                              </strong>
                            </div>
                          </div>
                          <Progress
                            value={Math.min(100, Math.max(6, item.score))}
                            className={cn('h-1.5 bg-bg-elevated', onTarget ? indicatorClass.green : indicatorClass.orange)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="py-10 px-5 rounded-[20px] bg-tint-sand/70 border border-dashed border-border-subtle text-center space-y-2">
                    <span className="mx-auto size-10 rounded-full bg-bg-surface border border-border-subtle flex items-center justify-center text-text-muted">
                      <FiTarget size={16} />
                    </span>
                    <p className="text-[14px] font-medium text-text-primary pt-1">
                      Your skill breakdown will appear here.
                    </p>
                    <p className="text-[12px] text-text-secondary leading-relaxed">
                      Complete your first evaluation to see topic strengths, gaps, and targeted practice recommendations.
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-2.5">
                  {modeBreakdown.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setActiveFilter(m.key)}
                      className={cn(
                        'w-full text-left p-4 rounded-[18px] border transition-colors duration-300 cursor-pointer',
                        activeFilter === m.key
                          ? 'bg-peach border-[#1D9E4B]/25'
                          : 'bg-bg-surface border-border-subtle hover:bg-surface-hover'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium text-[14px] text-text-primary">{m.mode}</span>
                        <span className="font-display font-normal text-[15px] text-[#1D9E4B]">{m.avgScore}% avg</span>
                      </div>
                      <div className="flex items-center justify-between text-[12px] text-text-muted">
                        <span>{m.total} total runs</span>
                        <span>{m.completed} evaluated</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border-subtle flex items-center justify-between gap-3 text-[12px] text-text-secondary">
              <span>Target benchmark: 80%</span>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <Link to="/mcq-generator" className="link-underline font-medium text-[#1D9E4B]">
                    Boost weakest topic &rarr;
                  </Link>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>Generate a targeted MCQ drill</TooltipContent>
              </UiTooltip>
            </div>
          </div>
        </section>

        {/* ─── 4. Practice & prep modules ─── */}
        <section className="dash-section space-y-10 pt-2">
          {/* Interview practice */}
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-3">
                <Eyebrow index="01">Interview practice</Eyebrow>
                <h2 className="font-display text-3xl sm:text-4xl font-normal tracking-[-0.045em] text-text-primary">
                  Practice <span className="serif italic text-[#1D9E4B]">rounds</span>
                </h2>
              </div>
              <span className="text-[13px] text-text-secondary">
                Active track: <strong className="font-medium text-text-primary">{selectedPreset.label}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
              {/* Featured: Live Voice Interview */}
              <motion.div
                whileHover={{ y: -4 }}
                transition={SPRING}
                className="md:col-span-2 lg:col-span-6 relative overflow-hidden rounded-[28px] bg-lilac border border-[#2496ED]/15 p-6 sm:p-8 flex flex-col justify-between gap-8 group"
              >
                <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 size-72 rounded-full bg-[#2496ED]/15 blur-3xl" />
                <div className="relative space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-full bg-bg-surface/80 px-3 py-1 text-[11px] font-medium text-[#1D6FB8] dark:text-[#8EC1FF]">
                      Featured interview
                    </span>
                    <span className="text-[12px] text-text-secondary">
                      {stats?.totalLiveInterviews || 0} runs &middot; {stats?.avgLiveScore || 0}% avg
                    </span>
                  </div>

                  <div className="flex items-start gap-4">
                    <span className="size-12 shrink-0 rounded-full bg-bg-surface shadow-sm flex items-center justify-center text-[#2496ED]">
                      <FiMic size={20} />
                    </span>
                    <div>
                      <h3 className="font-display text-2xl sm:text-[1.9rem] font-normal tracking-[-0.04em] text-text-primary">
                        Live Voice Interview
                      </h3>
                      <p className="text-[14px] text-text-secondary mt-2 leading-relaxed max-w-md">
                        Conversational adaptive voice practice with Shristi AI. Dynamic follow-ups testing technical depth and communication clarity.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {['Shristi AI', '3–10 Questions', 'Follow-up Probing', 'Voice + Text'].map((spec) => (
                      <span
                        key={spec}
                        className="rounded-full bg-bg-surface/70 border border-[#2496ED]/10 px-3 py-1 text-[12px] text-text-primary"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative pt-5 border-t border-[#2496ED]/15 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[13px] text-text-secondary">
                    Calibrated for <span className="text-text-primary font-medium">{selectedPreset.label}</span>
                  </span>
                  <Button onClick={startVoice} className="group">
                    Start voice
                    <FiArrowUpRight className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Button>
                </div>
              </motion.div>

              {/* Mock simulator */}
              <motion.div
                whileHover={{ y: -4 }}
                transition={SPRING}
                className="lg:col-span-3 rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between gap-6 group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="size-10 rounded-full bg-mint text-[#2F6B12] dark:text-[#A8E07E] flex items-center justify-center">
                      <FiVideo size={16} />
                    </span>
                    <span className="text-[12px] text-text-muted">{stats?.totalStructuredMocks || 0} runs</span>
                  </div>
                  <div>
                    <span className="eyebrow">3-pillar rubric</span>
                    <h3 className="heading-card text-text-primary mt-2 group-hover:text-[#1D9E4B] transition-colors">
                      Mock Simulator
                    </h3>
                    <p className="text-[13px] text-text-secondary mt-1.5 leading-relaxed">
                      Structured interview rounds evaluated across 3 rubrics with 0–10 scoring.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['3, 5, 8 Qs', 'Rubric Grading', 'Audio / Text'].map((spec) => (
                      <span key={spec} className="rounded-full bg-bg-elevated px-2.5 py-0.5 text-[11px] text-text-secondary">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => navigate('/mock-interview', { state: { jobRole: selectedPreset.role } })}
                >
                  Launch simulator <FiArrowRight />
                </Button>
              </motion.div>

              {/* Timed MCQ test */}
              <motion.div
                whileHover={{ y: -4 }}
                transition={SPRING}
                className="lg:col-span-3 rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between gap-6 group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="size-10 rounded-full bg-butter text-[#9A6B00] dark:text-[#F5D36B] flex items-center justify-center">
                      <FiList size={16} />
                    </span>
                    <span className="text-[12px] text-text-muted">{stats?.totalAssessments || 0} tests</span>
                  </div>
                  <div>
                    <span className="eyebrow">Auto-timer</span>
                    <h3 className="heading-card text-text-primary mt-2 group-hover:text-[#1D9E4B] transition-colors">
                      Timed MCQ Test
                    </h3>
                    <p className="text-[13px] text-text-secondary mt-1.5 leading-relaxed">
                      Rapid 90-second technical questions with automatic scoring and explanations.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['10–30 MCQs', 'Auto-Timer', 'Answer Key'].map((spec) => (
                      <span key={spec} className="rounded-full bg-bg-elevated px-2.5 py-0.5 text-[11px] text-text-secondary">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
                <Button variant="outline" className="w-full justify-between" onClick={startMcq}>
                  Start test <FiArrowRight />
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Preparation tools */}
          <div className="space-y-5">
            <div className="space-y-3">
              <Eyebrow index="02">Preparation tools</Eyebrow>
              <h2 className="font-display text-3xl sm:text-4xl font-normal tracking-[-0.045em] text-text-primary">
                Sharpen the <span className="serif italic text-[#1D9E4B]">edges</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  key: 'ats',
                  icon: FiFileText,
                  chip: 'bg-peach text-[#1D9E4B]',
                  meta: <>PDF &le; 5MB</>,
                  title: 'ATS Resume Match',
                  body: 'Keyword gap scan comparing your resume against targeted role job descriptions.',
                  cta: 'Scan resume',
                  onClick: () => navigate('/resume-analyzer'),
                },
                {
                  key: 'jd',
                  icon: FiBriefcase,
                  chip: 'bg-sky text-[#1D5FAF] dark:text-[#8EC1FF]',
                  meta: <>{stats?.totalAnalyses || 0} saved</>,
                  title: 'JD Study Roadmap',
                  body: 'Break down real job postings into a weekly preparation roadmap and priority skills.',
                  cta: 'Build roadmap',
                  onClick: () => navigate('/job-analysis'),
                },
                {
                  key: 'qbank',
                  icon: FiTool,
                  chip: 'bg-mint text-[#2F6B12] dark:text-[#A8E07E]',
                  meta: <>PDF export</>,
                  title: 'Question Bank',
                  body: 'Curated interview questions with model answers, core points, and pitfalls.',
                  cta: 'Explore questions',
                  onClick: () =>
                    navigate('/interview-questions', {
                      state: { jobRole: selectedPreset.role, skills: selectedPreset.skills },
                    }),
                },
              ].map(({ key, icon: Icon, chip, meta, title, body, cta, onClick }) => (
                <motion.div
                  key={key}
                  whileHover={{ y: -4 }}
                  transition={SPRING}
                  className="rounded-[24px] bg-bg-surface border border-border-subtle shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between gap-5 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={cn('size-10 rounded-full flex items-center justify-center', chip)}>
                        <Icon size={16} />
                      </span>
                      <span className="eyebrow">{meta}</span>
                    </div>
                    <h3 className="font-display text-lg font-normal tracking-[-0.03em] text-text-primary group-hover:text-[#1D9E4B] transition-colors">
                      {title}
                    </h3>
                    <p className="text-[13px] text-text-secondary leading-relaxed">{body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClick}
                    className="w-full pt-4 border-t border-border-subtle flex items-center justify-between text-[13px] font-medium text-text-primary hover:text-[#1D9E4B] transition-colors cursor-pointer"
                  >
                    <span>{cta}</span>
                    <span className="size-8 rounded-full bg-bg-elevated group-hover:bg-[#1D9E4B] group-hover:text-white flex items-center justify-center transition-colors">
                      <FiArrowUpRight size={14} />
                    </span>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. Recent activity ─── */}
        <section className="dash-section rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm overflow-hidden">
          <div className="p-5 sm:p-7 border-b border-border-subtle flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="size-9 rounded-full bg-bg-elevated flex items-center justify-center text-text-secondary">
                  <FiActivity size={15} />
                </span>
                <h2 className="font-display text-xl font-normal tracking-[-0.03em] text-text-primary">Recent activity</h2>
              </div>
              <FilterTabs value={activeFilter} onChange={setActiveFilter} items={ACTIVITY_FILTERS} />
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 lg:flex-none">
                <FiSearch className="w-3.5 h-3.5 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by role..."
                  className="h-10 pl-9 pr-4 rounded-full bg-bg-canvas border border-border-subtle text-[13px] text-text-primary placeholder:text-text-muted focus:border-[#1D9E4B]/60 focus:ring-4 focus:ring-[#1D9E4B]/10 focus:outline-none w-full lg:w-56 transition-shadow"
                />
              </div>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/history"
                    className="h-10 px-4 inline-flex items-center gap-1.5 rounded-full border border-border-subtle text-[13px] font-medium text-text-primary hover:border-text-primary/25 transition-colors shrink-0"
                  >
                    All ({recentActivity?.length || 0}) <FiArrowUpRight size={13} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>Open full session history</TooltipContent>
              </UiTooltip>
            </div>
          </div>

          {filteredActivities.length > 0 ? (
            <ul className="divide-y divide-border-subtle">
              {filteredActivities.slice(0, 7).map((activity, idx) => {
                const badge = getModeBadge(activity.type);
                const hasScore = activity.score !== undefined && activity.score !== null;
                return (
                  <li key={activity.id || idx}>
                    <button
                      type="button"
                      onClick={() => navigate(getActivityLink(activity))}
                      className="w-full text-left grid grid-cols-[1fr_auto] sm:grid-cols-[84px_minmax(0,1fr)_120px_190px_32px] items-center gap-x-5 gap-y-2 px-5 sm:px-7 py-4 hover:bg-surface-hover transition-colors cursor-pointer group"
                    >
                      <span className="col-start-1 row-start-1 sm:col-auto sm:row-auto">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </span>
                      <span className="col-span-2 sm:col-span-1 font-display text-[15px] font-normal tracking-[-0.02em] text-text-primary group-hover:text-[#1D9E4B] transition-colors truncate">
                        {activity.role || activity.title}
                      </span>
                      <span className="hidden sm:block text-[12px] text-text-muted">{formatDate(activity.date)}</span>
                      <span className="col-start-2 row-start-1 sm:col-auto sm:row-auto justify-self-end sm:justify-self-stretch">
                        {hasScore ? (
                          <span className="flex items-center gap-3">
                            <Progress
                              value={Math.min(100, Math.max(6, activity.score))}
                              className={cn(
                                'hidden sm:block h-1.5 flex-1 bg-bg-elevated',
                                activity.score >= 80
                                  ? indicatorClass.green
                                  : activity.score >= 60
                                  ? indicatorClass.orange
                                  : '[&>[data-slot=progress-indicator]]:bg-danger'
                              )}
                            />
                            <span className="font-display text-[15px] font-normal tabular-nums text-text-primary">
                              {activity.score}%
                            </span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-text-muted capitalize">{activity.status || 'Saved'}</span>
                        )}
                      </span>
                      <span className="hidden sm:flex size-8 rounded-full bg-bg-elevated group-hover:bg-[#1D9E4B] group-hover:text-white items-center justify-center text-text-secondary transition-colors justify-self-end">
                        <FiArrowUpRight size={14} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-16 px-5 text-center space-y-3">
              <span className="mx-auto size-12 rounded-full bg-peach text-[#1D9E4B] flex items-center justify-center">
                <FiActivity size={18} />
              </span>
              <p className="font-display text-xl font-normal tracking-[-0.03em] text-text-primary">Nothing here yet.</p>
              <p className="text-[13px] text-text-secondary">Your completed practice sessions will show up here.</p>
              <div className="pt-2">
                <Button size="sm" onClick={startVoice}>
                  Start practicing <FiArrowUpRight />
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </TooltipProvider>
  );
};

export default Dashboard;
