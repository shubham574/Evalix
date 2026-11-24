import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { ArrowUpRight, Check, Mic, Moon, Sun, Sparkles, MousePointer2, FileText, ListChecks, Briefcase, Flame, TrendingUp } from 'lucide-react';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { FiGithub, FiLinkedin, FiMail } from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';
import { EvalixOrb } from '../components/ui/EvalixOrb';
import { useTheme } from '../hooks/useTheme';
import { useSmoothScroll, scrollToId } from '../hooks/useSmoothScroll';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/shadcn/accordion';
import { NumberTicker, ScoreRing } from '@/components/studio';
import Dock, { EvalixMark } from '@/components/studio/Dock';
import IsoScene from '@/components/studio/IsoScene';
import { Say, Speaker, DrawPath } from '@/components/studio/Say';
import SkyScene from '@/components/studio/SkyScene';
import { XPPill, HoldKey, ScrollRuler, awardXP, isMotionOff, toggleMotion, EASE_ZERO_OUT } from '@/components/studio/Gamify';
import { cn } from '@/lib/utils';

const EASE_OUT = EASE_ZERO_OUT; // reference CustomEase "zeroOut"

// ─── Content ─────────────────────────────────────────────────────────────────
const NAV = [
  { label: 'Capabilities', target: 'capabilities' },
  { label: 'Tracks', target: 'tracks' },
  { label: 'How it works', target: 'how-it-works' },
  { label: 'Report', target: 'report' },
  { label: 'FAQ', target: 'faq' },
];

const arcTopics = [
  'React 19', 'Redis Streams', 'CAP theorem', 'STAR stories', 'Idempotency', 'B-tree indexes', 'Rate limiting',
  'Graph cycles', 'Hooks', 'Kafka', 'Sharding', 'Big-O', 'Next.js', 'Webhooks', 'Caching', 'Resume defense',
  'PostgreSQL', 'Concurrency', 'Dynamic programming', 'Load balancing', 'OAuth', 'Leadership', 'TypeScript', 'Docker',
];

const capabilities = [
  { icon: Mic, title: 'Voice interviews', desc: 'Speak naturally. Shristi listens and probes.' },
  { icon: FileText, title: 'Resume matching', desc: 'Find the gaps between you and the job.' },
  { icon: ListChecks, title: 'Timed MCQs', desc: '10–30 questions, 90 seconds each.' },
  { icon: Sparkles, title: 'AI feedback', desc: 'A rubric score on every single answer.' },
];

const trackCategories = ['Popular', 'Frontend', 'Backend', 'System design', 'Behavioral', 'Freshers'];

const practiceTracks = [
  {
    title: 'Frontend Engineer',
    route: '/mock-interview-for-react-developers',
    cats: ['Popular', 'Frontend'],
    badge: { label: 'Trending', icon: TrendingUp },
    question: 'How does React 19 prioritize urgent input over heavy transitions?',
    topics: ['React 19', 'Hooks', 'Perf'],
    wash: 'from-[#E6F4EA] via-[#F4FBF6] to-white',
    orb: 'speaking',
  },
  {
    title: 'Backend Engineer',
    route: '/live-interview',
    cats: ['Popular', 'Backend'],
    badge: { label: 'Hot', icon: Flame },
    question: 'Design an idempotent webhook receiver for Stripe retries.',
    topics: ['Node.js', 'Postgres', 'Redis'],
    wash: 'from-[#E6F0FB] via-[#F3F8FE] to-white',
    orb: 'listening',
  },
  {
    title: 'System Design',
    route: '/system-design-mock-interview',
    cats: ['Popular', 'System design'],
    question: 'Design a multi-region rate limiter at 1M RPS, sub-5ms.',
    topics: ['Capacity', 'Caching', 'CAP'],
    wash: 'from-[#FFF6D6] via-[#FFFBEF] to-white',
    orb: 'thinking',
  },
  {
    title: 'DSA & Freshers',
    route: '/mock-interview-for-freshers',
    cats: ['Freshers', 'Backend'],
    question: 'Detect a cycle in a directed graph and print the path.',
    topics: ['Graphs', 'DP', 'Big-O'],
    wash: 'from-[#ECF7E3] via-[#F6FBF1] to-white',
    orb: 'evaluating',
  },
  {
    title: 'HR & Behavioral',
    route: '/resume-based-interview-questions',
    cats: ['Popular', 'Behavioral'],
    question: 'Tell me about a production outage you caused.',
    topics: ['STAR', 'Resume', 'Conflict'],
    wash: 'from-[#FDE7DC] via-[#FEF4EE] to-white',
    orb: 'idle',
  },
];

const steps = [
  { title: 'Pick your role.', body: 'Frontend, backend, system design — or paste any job description.', mock: 'role' },
  { title: 'Answer out loud.', body: 'Shristi asks, listens, and follows up on what you skipped.', mock: 'voice' },
  { title: 'Get coached along the way.', body: 'What worked, what to fix, and a model answer to compare.', mock: 'coach' },
  { title: 'Watch your readiness climb.', body: 'Every session feeds one honest score across topics.', mock: 'progress' },
];

const performanceReports = [
  {
    id: 'r1',
    code: 'Frontend',
    role: 'Frontend Engineering',
    question: 'How does React 19 concurrent rendering prioritize urgent user input?',
    overallScore: 92,
    depth: '9.4',
    clarity: '9.1',
    whatWorked: 'Distinguished SyncLane urgent updates from interruptible TransitionLane work.',
    whatToImprove: 'Mention lane expiration timestamps to prevent continuous input starvation.',
  },
  {
    id: 'r2',
    code: 'Backend',
    role: 'Backend Engineering',
    question: 'When does a composite B-tree index hurt database throughput?',
    overallScore: 89,
    depth: '8.9',
    clarity: '9.0',
    whatWorked: 'Accurately cited PostgreSQL Heap-Only Tuple (HOT) update invalidation.',
    whatToImprove: 'Consider partial indexes (WHERE clause) to keep the index compact.',
  },
  {
    id: 'r3',
    code: 'System design',
    role: 'System Design',
    question: 'How do you recover if a payment call succeeds but the local DB fails?',
    overallScore: 94,
    depth: '9.5',
    clarity: '9.2',
    whatWorked: 'Combined the Transactional Outbox pattern with asynchronous webhook replay.',
    whatToImprove: 'State the reconciliation retry interval and exponential backoff ceiling.',
  },
];

const faqs = [
  {
    q: 'How does the AI voice interview work?',
    a: 'Pick your role, seniority, and session length. Shristi speaks each question out loud, transcribes your spoken answer, probes follow-ups on trade-offs, and produces an instant diagnostic report.',
  },
  {
    q: 'Can I upload my PDF resume and match it against a job description?',
    a: 'Yes. Upload your PDF resume and paste any target job description. Evalix calculates your ATS match score, highlights missing keywords, and tailors questions to your projects.',
  },
  {
    q: 'Can I switch between speaking and typing during a session?',
    a: 'Yes. Every interview session supports both live microphone recording and keyboard input. You can switch between voice and text at any point without losing your place.',
  },
  {
    q: 'How do custom Gemini API keys work?',
    a: 'Evalix works out of the box with shared limits. You can also connect your free Google AI Studio Gemini API key from the navigation bar for dedicated personal rate limits.',
  },
];

// ─── Small pieces ────────────────────────────────────────────────────────────
const Waveform = ({ bars = 18, className, color = '#1D9E4B' }) => {
  const heights = [30, 60, 40, 85, 95, 50, 70, 90, 40, 75, 100, 60, 45, 85, 65, 40, 80, 55, 90, 45];
  return (
    <div className={cn('flex items-center gap-[3px] h-6', className)} aria-hidden="true">
      {heights.slice(0, bars).map((h, i) => (
        <motion.span
          key={i}
          animate={{ height: [`${Math.max(18, h * 0.4)}%`, `${h}%`, `${Math.max(22, h * 0.55)}%`] }}
          transition={{ repeat: Infinity, duration: 0.85 + (i % 4) * 0.15, ease: 'easeInOut' }}
          className="w-[3px] rounded-full"
          style={{ backgroundColor: color, opacity: 0.35 + (i % 3) * 0.25 }}
        />
      ))}
    </div>
  );
};

/** White product window with a hairline ring — used for the timeline mocks. */
const Window = ({ title, children, className }) => (
  <div className={cn('rounded-[22px] bg-bg-surface shadow-lg overflow-hidden', className)}>
    <div className="flex items-center gap-2 px-4 h-10 border-b border-line">
      <span className="size-2.5 rounded-full bg-[rgba(15,15,15,0.12)]" />
      <span className="size-2.5 rounded-full bg-[rgba(15,15,15,0.12)]" />
      <span className="size-2.5 rounded-full bg-[rgba(15,15,15,0.12)]" />
      <span className="ml-2 font-mono text-[11px] text-text-muted">{title}</span>
    </div>
    <div className="p-5 sm:p-6">{children}</div>
  </div>
);

const StepMock = ({ kind }) => {
  if (kind === 'role')
    return (
      <Window title="evalix / new session">
        <p className="text-sm text-text-muted mb-3">Target role</p>
        <div className="key w-full justify-start !h-12 text-text-secondary">Senior Frontend Engineer</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Frontend', 'Backend', 'System design', 'Behavioral', 'Freshers'].map((c, i) => (
            <span key={c} className={cn('h-9 px-3.5 inline-flex items-center rounded-full text-[13px]', i === 0 ? 'bg-peach text-[#167A3A]' : 'bg-bg-elevated text-text-secondary')}>
              {c}
            </span>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-text-muted">Questions</span>
          <div className="flex gap-1 p-1 rounded-[14px] bg-bg-elevated">
            {[3, 5, 8, 10].map((n) => (
              <span key={n} className={cn('h-8 w-10 inline-flex items-center justify-center rounded-[10px] text-sm', n === 5 ? 'bg-bg-surface shadow-[var(--shadow-key)]' : 'text-text-muted')}>{n}</span>
            ))}
          </div>
        </div>
      </Window>
    );
  if (kind === 'voice')
    return (
      <Window title="evalix / voice room">
        <div className="flex items-center gap-4">
          <EvalixOrb state="speaking" size="md" />
          <p className="font-display text-lg leading-snug tracking-[-0.025em]">
            “Your table lags with 8,000 live rows. How do you keep input under 16ms?”
          </p>
        </div>
        <div className="mt-5 rounded-[16px] bg-bg-elevated p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#167A3A] inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#36C267] animate-pulse" /> Listening</span>
            <Waveform bars={14} className="h-5" />
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">“I virtualize the viewport so only ~28 rows mount, and batch socket ticks into one rAF flush…”</p>
        </div>
      </Window>
    );
  if (kind === 'coach')
    return (
      <Window title="evalix / feedback">
        <div className="grid gap-3">
          <div className="rounded-[16px] bg-peach p-4">
            <p className="text-xs text-[#167A3A] mb-1 inline-flex items-center gap-1.5"><Check className="size-3.5" /> What worked</p>
            <p className="text-sm leading-relaxed">Clear split between urgent and transition updates.</p>
          </div>
          <div className="rounded-[16px] bg-butter p-4">
            <p className="text-xs text-[#8A6400] mb-1">Δ Fix next time</p>
            <p className="text-sm leading-relaxed">Mention lane expiration to prevent input starvation.</p>
          </div>
          <div className="rounded-[16px] bg-sky p-4">
            <p className="text-xs text-[#1D6FB8] mb-1">Model answer</p>
            <p className="serif text-[17px] leading-snug">“Expired lanes are escalated to synchronous work…”</p>
          </div>
        </div>
      </Window>
    );
  return (
    <Window title="evalix / readiness">
      <div className="flex items-center gap-6">
        <ScoreRing value={84} size={104} stroke={8} color="#1D9E4B">
          <span className="font-display text-3xl tracking-[-0.05em]">84</span>
        </ScoreRing>
        <svg viewBox="0 0 200 80" className="flex-1 h-20" aria-hidden="true">
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#36C267" stopOpacity="0.35" />
              <stop offset="1" stopColor="#36C267" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 64 L33 52 L66 56 L100 38 L133 30 L166 22 L200 10 L200 80 L0 80 Z" fill="url(#spark)" />
          <path d="M0 64 L33 52 L66 56 L100 38 L133 30 L166 22 L200 10" fill="none" stroke="#1D9E4B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="mt-5 space-y-2.5">
        {[['System design', 72], ['React', 91], ['Databases', 68]].map(([t, v]) => (
          <div key={t} className="flex items-center gap-3 text-sm">
            <span className="w-28 text-text-secondary">{t}</span>
            <span className="flex-1 h-1.5 rounded-full bg-bg-elevated overflow-hidden"><span className="block h-full rounded-full bg-[#1D9E4B]" style={{ width: `${v}%` }} /></span>
            <span className="w-8 text-right tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </Window>
  );
};

/** Arc of topic chips that slowly rotates with scroll (reference: company-logo arc). */
const TopicArc = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const rot = useTransform(scrollYProgress, [0, 1], [-8, 8]);
  const R = 900;
  return (
    <div ref={ref} className="relative h-[300px] sm:h-[340px] overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <motion.div className="absolute left-1/2 top-[110px]" style={{ rotate: rot }}>
        {arcTopics.map((t, i) => {
          const a = ((i - (arcTopics.length - 1) / 2) * 5.2 * Math.PI) / 180;
          const x = Math.sin(a) * R;
          const y = R - Math.cos(a) * R;
          return (
            <span
              key={t}
              className="absolute whitespace-nowrap rounded-full bg-white/80 px-4 py-2 text-[15px] text-[#1C4839] backdrop-blur-sm shadow-[inset_0_-3px_0_rgba(0,0,0,0.05),0_10px_20px_-14px_rgba(28,72,57,0.5)]"
              style={{ transform: `translate(-50%, 0) translate(${x}px, ${y + (i % 2) * 64}px) rotate(${(a * 180) / Math.PI}deg)` }}
            >
              {t}
            </span>
          );
        })}
      </motion.div>
    </div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────
const Landing = () => {
  useSmoothScroll();
  const { theme, toggleTheme } = useTheme();
  const [cat, setCat] = useState('Popular');
  const [reportIdx, setReportIdx] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [greeted, setGreeted] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const heroRef = useRef(null);
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const sceneY = useTransform(heroP, [0, 1], ['0%', '18%']);
  const titleY = useTransform(heroP, [0, 1], ['0%', '-40%']);
  const titleO = useTransform(heroP, [0, 0.7], [1, 0]);

  const tracks = practiceTracks.filter((t) => t.cats.includes(cat));
  const report = performanceReports[reportIdx];

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary font-body overflow-x-clip">
      <SEOHead
        title="Evalix — Practice Technical & Voice Interviews with AI"
        description="Practice AI voice mock interviews, scan your PDF resume against job descriptions, and take timed technical MCQ assessments."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/"
      />
      <a href="#how-it-works" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] key key--sm">
        Skip to how it works
      </a>

      {/* ═══ Top corner marks (no navbar — navigation lives in the dock) ═══ */}
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 sm:px-8 h-[72px] transition-[background,backdrop-filter] duration-500',
          scrolled && 'bg-bg-canvas/70 backdrop-blur-xl'
        )}
      >
        <Link to="/" className="flex items-center gap-2" aria-label="Evalix home">
          <EvalixMark size={26} />
          <span className="font-display text-[21px] tracking-[-0.05em]">Evalix</span>
        </Link>
        <div className="flex items-center gap-2">
          <XPPill className="hidden sm:inline-flex" />
          <button type="button" onClick={toggleTheme} aria-label="Toggle color theme" className="key key--sm key--icon !w-10">
            {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </button>
          <SignedOut>
            <Link to="/login" className="key key--sm">Sign in</Link>
          </SignedOut>
          <SignedIn>
            <Link to="/dashboard" className="key key--sm hidden sm:inline-flex">Dashboard</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </header>

      <ScrollRuler sections={NAV.map((n) => ({ id: n.target, label: n.label }))} />

      <Dock
        links={[
          ...NAV.map((n) => ({ label: n.label, onClick: () => scrollToId(n.target) })),
          { label: isMotionOff() ? 'Turn motion on' : 'Reduce motion', onClick: toggleMotion },
        ]}
        help={
          <>
            <p className="font-display text-xl text-text-primary tracking-[-0.03em] mb-2">What is Evalix?</p>
            Practice technical interviews out loud with Shristi, an AI interviewer. Pick a role, answer by voice or text, and get a
            rubric score with a model answer for every question. Free to start.
          </>
        }
      />

      <main id="main-content">
        {/* ═══ HERO — fog over an isometric practice campus ═══ */}
        <section ref={heroRef} id="hero" className="relative h-[100svh] min-h-[720px] flex flex-col items-center justify-center overflow-hidden">
          <motion.div className="absolute inset-0" style={{ y: sceneY }}>
            <div className="absolute inset-0 [--iso-scale:0.62] [--iso-y:80%] sm:[--iso-scale:0.9] md:[--iso-scale:1.25] md:[--iso-y:74%]">
              <IsoScene />
            </div>
          </motion.div>

          <motion.div style={{ y: titleY, opacity: titleO }} className="relative z-10 -mt-[18vh] px-5 text-center">
            <h1 className="heading-hero text-text-primary">
              {[
                <>The interview is a <span className="serif italic text-[#1D9E4B] tracking-[-0.03em]">skill.</span></>,
                <>
                  Train it.
                  <span className="inline-flex ml-3 sm:ml-4 align-middle -translate-y-[0.1em]">
                    <Speaker size="md" />
                  </span>
                </>,
              ].map((line, i) => (
                <span key={i} className="block overflow-hidden pb-[0.08em]">
                  <motion.span
                    className="block"
                    initial={{ y: '105%' }}
                    animate={{ y: '0%' }}
                    transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.15 + i * 0.12 }}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.55 }}
              className="mt-6 text-lg text-text-secondary max-w-md mx-auto text-pretty"
            >
              Practice out loud with Shristi — an AI interviewer that listens, probes, and scores every answer.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.75 }}
              className="mt-8 flex flex-col items-center gap-3"
            >
              <HoldKey
                label="Hold to answer"
                doneLabel="That's the feeling"
                onComplete={() => {
                  setGreeted(true);
                  awardXP('hero-hold', 50, 'You found your voice');
                }}
              />
              <AnimatePresence>
                {greeted && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: EASE_OUT }}
                    className="max-w-xs rounded-[16px] bg-bg-surface px-4 py-3 text-[15px] text-text-secondary shadow-md"
                  >
                    <span className="text-text-primary">Shristi:</span> “Nice. Every session starts just like that — now let's make the answer count.”
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          <motion.button
            type="button"
            onClick={() => scrollToId('capabilities')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute bottom-[120px] z-10 inline-flex items-center gap-2 text-[15px] text-text-secondary cursor-pointer"
          >
            <span className="relative inline-flex h-7 w-[18px] justify-center rounded-full ring-[1.5px] ring-[rgba(15,15,15,0.35)]">
              <motion.span className="mt-1.5 h-1.5 w-[3px] rounded-full bg-text-secondary" animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} />
            </span>
            Scroll down
          </motion.button>
        </section>

        {/* ═══ CAPABILITIES — why.zero-style sky stage ═══ */}
        <SkyScene id="capabilities">
          <div className="relative text-center px-5 -mt-10">
            <p className="font-display text-[clamp(1.4rem,1rem+1.2vw,2rem)] leading-tight tracking-[-0.035em] text-[#1C4839]">
              Four ways to practice every round. All in one room.
            </p>
          </div>
          <TopicArc />
          <div className="relative max-w-[1200px] mx-auto px-5 pb-28 sm:pb-36 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {capabilities.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.8, ease: EASE_OUT, delay: i * 0.06 }}
                className="rounded-[22px] glass shadow-md p-5 sm:p-6"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-[13px] bg-white text-[#1C4839] shadow-[var(--shadow-key)]">
                  <c.icon className="size-[18px]" />
                </span>
                <h3 className="mt-5 font-display text-xl tracking-[-0.03em] text-[#0F0F0F]">{c.title}</h3>
                <p className="mt-1 text-[15px] text-[#3F4240] leading-snug">{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </SkyScene>

        {/* ═══ TRACKS — carousel with category tabs ═══ */}
        <section id="tracks" className="py-28 sm:py-36">
          <Say>We train you for the toughest rounds.</Say>

          <div className="mt-10 flex justify-center px-4">
            <div className="flex gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label="Track categories">
              {trackCategories.map((c) => (
                <button
                  key={c}
                  role="tab"
                  type="button"
                  aria-selected={cat === c}
                  onClick={() => { setCat(c); awardXP('explore-tracks', 10, 'Explorer — browsing tracks'); }}
                  className={cn(
                    'relative shrink-0 h-10 px-4 rounded-full text-[15px] tracking-[-0.01em] transition-colors cursor-pointer',
                    cat === c ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  {c}
                  {cat === c && <motion.span layoutId="catLine" className="absolute left-4 right-4 -bottom-0.5 h-[2px] rounded-full bg-text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 overflow-x-auto no-scrollbar" data-lenis-prevent-wheel>
            <div className="flex gap-4 px-5 sm:px-[max(20px,calc((100vw-1240px)/2))] pb-4 w-max">
              <AnimatePresence mode="popLayout">
                {tracks.map((t, i) => (
                  <motion.div
                    key={t.title}
                    layout
                    initial={{ opacity: 0, scale: 0.96, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.05 }}
                  >
                    <Link
                      to={t.route}
                      className={cn(
                        'group relative flex h-[440px] w-[290px] sm:w-[320px] flex-col justify-between overflow-hidden rounded-[22px] bg-gradient-to-b p-5 shadow-md transition-transform duration-500 hover:-translate-y-1',
                        t.wash
                      )}
                    >
                      <div className="flex items-start justify-between">
                        {t.badge ? (
                          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white text-[13px] shadow-[var(--shadow-key)]">
                            <t.badge.icon className="size-3.5 text-[#1D9E4B]" /> {t.badge.label}
                          </span>
                        ) : <span />}
                        <span className="size-10 rounded-full bg-white/80 inline-flex items-center justify-center transition-transform duration-500 group-hover:rotate-45">
                          <ArrowUpRight className="size-4" />
                        </span>
                      </div>
                      <div className="flex flex-1 items-center justify-center">
                        <motion.div whileHover={{ scale: 1.06 }} transition={{ type: 'spring', stiffness: 240, damping: 18 }}>
                          <EvalixOrb state={t.orb} size="xl" />
                        </motion.div>
                      </div>
                      <div>
                        <p className="serif italic text-[17px] leading-snug text-text-secondary mb-4">“{t.question}”</p>
                        <h3 className="font-display text-2xl tracking-[-0.035em]">{t.title}</h3>
                        <div className="mt-3 flex gap-1.5">
                          {t.topics.map((tp) => (
                            <span key={tp} className="h-7 px-2.5 inline-flex items-center rounded-full bg-white/85 text-xs text-text-secondary">{tp}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS — hand-drawn timeline ═══ */}
        <section id="how-it-works" className="relative py-28 sm:py-36 bg-wall">
          <Say>Learn the interview by doing it.</Say>

          <div className="relative max-w-[1200px] mx-auto mt-20 px-5">
            <DrawPath
              className="absolute left-[38px] sm:left-[58px] top-0 h-full w-[60px] text-text-primary"
              viewBox="0 0 60 1000"
              d="M30 0 C 58 140, 4 260, 30 400 S 56 640, 30 760 S 6 900, 30 1000"
            />
            <div className="space-y-24 sm:space-y-32">
              {steps.map((s, i) => (
                <div key={s.title} className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pl-16 sm:pl-24">
                  <span className="absolute left-[26px] sm:left-[46px] top-2 lg:top-1/2 lg:-translate-y-1/2 size-6 rounded-full bg-bg-surface ring-1 ring-line shadow-sm flex items-center justify-center">
                    <span className="size-2 rounded-full bg-[#1D9E4B]" />
                  </span>
                  <motion.div
                    className="lg:col-span-5"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.9, ease: EASE_OUT }}
                  >
                    <span className="font-mono text-xs text-text-muted">0{i + 1}</span>
                    <h3 className="mt-2 font-display text-[clamp(1.7rem,1.2rem+1.4vw,2.6rem)] leading-[1.02] tracking-[-0.045em]">
                      {s.title} <Speaker size="sm" className="ml-1 -translate-y-1" state={i % 2 ? 'listening' : 'speaking'} />
                    </h3>
                    <p className="mt-3 text-[17px] text-text-secondary leading-relaxed max-w-sm">{s.body}</p>
                  </motion.div>
                  <motion.div
                    className="lg:col-span-7"
                    initial={{ opacity: 0, y: 40, rotate: i % 2 ? 1.5 : -1.5 }}
                    whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 1, ease: EASE_OUT }}
                  >
                    <StepMock kind={s.mock} />
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ REPORT — "You practice. We score." ═══ */}
        <section id="report" className="py-28 sm:py-36">
          <Say>You practice. We score.</Say>

          <div className="mt-10 flex justify-center">
            <div className="inline-flex gap-1 p-1 rounded-[16px] bg-bg-elevated" role="tablist" aria-label="Sample reports">
              {performanceReports.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={reportIdx === idx}
                  onClick={() => setReportIdx(idx)}
                  className={cn(
                    'h-10 px-4 rounded-[12px] text-[14px] transition-all cursor-pointer',
                    reportIdx === idx ? 'bg-bg-surface shadow-[var(--shadow-key)] text-text-primary' : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  {r.code}
                </button>
              ))}
            </div>
          </div>

          <div className="relative max-w-[1100px] mx-auto mt-14 px-5">
            {[
              { t: `Depth ${report.depth}`, c: 'left-0 top-10', d: 0 },
              { t: `Clarity ${report.clarity}`, c: 'right-0 top-24', d: 0.1 },
              { t: 'Model answer ready', c: 'left-6 bottom-10', d: 0.2 },
            ].map((tag) => (
              <motion.span
                key={tag.t}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1], delay: tag.d }}
                className={cn('hidden lg:inline-flex absolute z-10 key key--sm animate-float', tag.c)}
              >
                <Check className="size-3.5 text-[#1D9E4B]" /> {tag.t}
              </motion.span>
            ))}

            <AnimatePresence mode="wait">
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                className="mx-auto max-w-[760px] rounded-[22px] bg-bg-surface shadow-lg overflow-hidden"
              >
                <div className="h-24 bg-[linear-gradient(120deg,#1C4839_0%,#1D9E4B_55%,#2496ED_100%)]" />
                <div className="px-6 sm:px-8 pb-8 -mt-12">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="rounded-full bg-bg-surface p-1.5 shadow-md">
                      <ScoreRing value={report.overallScore} size={104} stroke={8} color="#1D9E4B">
                        <span className="font-display text-3xl tracking-[-0.05em]"><NumberTicker value={report.overallScore} /></span>
                      </ScoreRing>
                    </div>
                    <span className="key key--sm"><FileText className="size-4" /> Full report</span>
                  </div>
                  <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Scorecard · {report.role}</p>
                  <h3 className="mt-2 font-display text-[clamp(1.4rem,1rem+1vw,1.9rem)] leading-tight tracking-[-0.035em]">“{report.question}”</h3>
                  <div className="mt-6 flex gap-5 border-b border-line text-[14px]">
                    {['Feedback', 'Model answer', 'Transcript'].map((t, i) => (
                      <span key={t} className={cn('pb-3', i === 0 ? 'text-text-primary border-b-2 border-text-primary -mb-px' : 'text-text-muted')}>{t}</span>
                    ))}
                  </div>
                  <div className="mt-5 grid sm:grid-cols-2 gap-3">
                    <div className="rounded-[16px] bg-peach p-4">
                      <p className="text-xs text-[#167A3A] mb-1.5 inline-flex items-center gap-1.5"><Check className="size-3.5" /> What worked</p>
                      <p className="text-[15px] leading-relaxed">{report.whatWorked}</p>
                    </div>
                    <div className="rounded-[16px] bg-butter p-4">
                      <p className="text-xs text-[#8A6400] mb-1.5">Δ Focus next session</p>
                      <p className="text-[15px] leading-relaxed">{report.whatToImprove}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section id="faq" className="py-24 sm:py-32 bg-wall">
          <Say speaker={false}>Questions, answered.</Say>
          <div className="max-w-3xl mx-auto mt-12 px-5">
            <Accordion type="single" collapsible defaultValue="faq-0" className="rounded-[22px] bg-bg-surface shadow-sm px-6 sm:px-8">
              {faqs.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i}`} className="border-line last:border-b-0">
                  <AccordionTrigger className="text-lg sm:text-xl font-normal py-6 tracking-[-0.025em] hover:no-underline hover:text-[#1D9E4B]">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 text-base text-text-secondary leading-relaxed">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ═══ CLOSER — "Built to get you hired." ═══ */}
        <section className="py-32 sm:py-44 text-center px-5">
          <Say
            words={['Built', 'to', 'get', 'you']}
            after={
              <>
                <motion.span
                  className="inline-flex align-middle mx-3 -translate-y-[0.08em]"
                  initial={{ rotate: -12, scale: 0.6, opacity: 0 }}
                  whileInView={{ rotate: -6, scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1], delay: 0.25 }}
                >
                  <span className="relative inline-flex h-[1.05em] w-[0.85em] flex-col justify-center gap-[0.08em] rounded-[0.14em] bg-bg-surface p-[0.12em] shadow-md">
                    <span className="h-[0.06em] w-3/4 rounded-full bg-[rgba(15,15,15,0.2)]" />
                    <span className="h-[0.06em] w-1/2 rounded-full bg-[rgba(15,15,15,0.12)]" />
                    <span className="h-[0.06em] w-2/3 rounded-full bg-[rgba(15,15,15,0.12)]" />
                    <span className="absolute -right-[0.14em] -top-[0.14em] inline-flex size-[0.36em] items-center justify-center rounded-full bg-[#1D9E4B] text-white">
                      <Check className="size-[0.22em]" strokeWidth={3} />
                    </span>
                  </span>
                </motion.span>
                <span className="inline-block">hired.</span>
              </>
            }
          />
          <p className="mt-6 text-[17px] text-text-secondary">Start free. Bring your own Gemini key for unlimited sessions.</p>
          <div className="mt-9 flex justify-center gap-2.5">
            <SignedIn>
              <Link to="/live-interview" className="key key--lg key--green"><Mic className="size-4" /> Start practicing</Link>
            </SignedIn>
            <SignedOut>
              <Link to="/register" className="key key--lg key--green"><Mic className="size-4" /> Start practicing</Link>
            </SignedOut>
            <button type="button" onClick={() => scrollToId('tracks')} className="key key--lg hidden sm:inline-flex">
              <Briefcase className="size-4" /> Browse tracks
            </button>
          </div>
        </section>
      </main>

      {/* ═══ FINALE — the campus in full colour, with the footer laid over it ═══ */}
      <motion.footer
        id="footer"
        onViewportEnter={() => awardXP('saw-it-all', 25, 'You made it to the end')}
        viewport={{ amount: 0.5 }}
        className="relative h-[86svh] min-h-[620px] overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_60%,#E4F3EA_0%,#EEF4F1_45%,var(--bg-canvas)_80%)]" />
        <div className="absolute inset-x-0 top-0 h-40 z-10 bg-gradient-to-b from-bg-canvas to-transparent" />
        <div className="absolute inset-0 [--iso-scale:0.8] sm:[--iso-scale:1.05] md:[--iso-scale:1.32] [--iso-y:57%]">
          <IsoScene vivid />
        </div>
        <div className="absolute left-1/2 top-[54%] z-10 -translate-x-1/2 -translate-y-1/2">
          <SignedOut>
            <Link to="/register" className="key key--lg key--green tracking-[0.2em] uppercase text-[15px] shadow-[0_0_0_10px_rgba(54,194,103,0.18),0_0_60px_rgba(54,194,103,0.6)]">
              <MousePointer2 className="size-4" /> Start
            </Link>
          </SignedOut>
          <SignedIn>
            <Link to="/live-interview" className="key key--lg key--green tracking-[0.2em] uppercase text-[15px] shadow-[0_0_0_10px_rgba(54,194,103,0.18),0_0_60px_rgba(54,194,103,0.6)]">
              <MousePointer2 className="size-4" /> Start
            </Link>
          </SignedIn>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[104px] sm:pb-5">
          <div className="mx-auto max-w-[1320px] flex flex-col sm:flex-row items-center justify-between gap-3 rounded-[18px] glass shadow-md px-4 py-3 text-[13px] text-text-secondary">
            <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-1">
              <Link to="/mock-interview-for-react-developers" className="hover:text-text-primary">Frontend</Link>
              <Link to="/system-design-mock-interview" className="hover:text-text-primary">System design</Link>
              <Link to="/resume-based-interview-questions" className="hover:text-text-primary">HR & behavioral</Link>
              <Link to="/mock-interview-for-freshers" className="hover:text-text-primary">Freshers</Link>
              <span className="text-text-muted">© 2026 Evalix</span>
            </nav>
            <div className="flex items-center gap-3">
              <a href="https://github.com/shubham574/Evalix" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:text-text-primary"><FiGithub className="size-4" /></a>
              <a href="https://www.linkedin.com/in/shubham-maurya-937511309/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:text-text-primary"><FiLinkedin className="size-4" /></a>
              <a href="mailto:contact@evalix.ai" aria-label="Contact" className="hover:text-text-primary"><FiMail className="size-4" /></a>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

export default Landing;
