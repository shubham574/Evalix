import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  FiArrowRight,
  FiArrowUpRight,
  FiSun,
  FiMoon,
  FiGithub,
  FiLinkedin,
  FiMail,
  FiMenu,
  FiX,
  FiPlus,
  FiMinus,
} from 'react-icons/fi';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import SEOHead from '../components/common/SEOHead';
import { EvalixOrb } from '../components/ui/EvalixOrb';
import { useTheme } from '../hooks/useTheme';

// Register ScrollTrigger safely
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// ─── Hero Interactive Product Visual Data ────────────────────────────────────
const heroSessions = [
  {
    id: 'frontend',
    code: '01',
    track: 'Frontend Engineering',
    role: 'Senior React Engineer',
    question:
      'Your analytics table lags rendering 8,000 rows with live WebSocket ticks. How do you keep interactions under 16ms?',
    candidateTranscript:
      'I virtualize the viewport with TanStack Virtual so only ~28 DOM nodes mount at once. Incoming WebSocket messages buffer inside a mutable ref and flush at 100ms intervals via requestAnimationFrame.',
    metrics: [
      { label: 'Technical Depth', score: '9.4', bar: 94, accent: '#C7F36B' },
      { label: 'Answer Clarity', score: '9.1', bar: 91, accent: '#FF6B35' },
    ],
    signals: ['Virtualization', 'rAF Batching', 'Zero Blocking'],
  },
  {
    id: 'backend',
    code: '02',
    track: 'Backend Systems',
    role: 'Distributed Systems Engineer',
    question:
      'A client retries POST /checkout after a network timeout. How do you guarantee the customer is never charged twice?',
    candidateTranscript:
      'Require an Idempotency-Key UUID header. Acquire an atomic SETNX lock in Redis with a 24-hour TTL and commit an idempotency record inside the database transaction before calling Stripe.',
    metrics: [
      { label: 'Technical Depth', score: '9.6', bar: 96, accent: '#C7F36B' },
      { label: 'Answer Clarity', score: '9.3', bar: 93, accent: '#FF6B35' },
    ],
    signals: ['Idempotency-Key', 'Redis SETNX', 'Transactional Ledger'],
  },
  {
    id: 'behavioral',
    code: '03',
    track: 'Behavioral & Project',
    role: 'Software Engineer',
    question:
      'On your resume, you reduced p99 latency by 45%. Which query caused the bottleneck, and how did you verify the fix?',
    candidateTranscript:
      'pg_stat_statements showed an unindexed JSONB filter scanning 1.4M rows. I created a partial B-tree composite index on status and tenant_id, dropping query time from 620ms to 11ms under k6 load tests.',
    metrics: [
      { label: 'Technical Depth', score: '9.2', bar: 92, accent: '#C7F36B' },
      { label: 'Answer Clarity', score: '9.5', bar: 95, accent: '#FF6B35' },
    ],
    signals: ['pg_stat_statements', 'Partial Index', 'k6 Benchmark'],
  },
];

// ─── Phase 3: Capabilities Strip (Compact, Refined Copy) ─────────────────────
const capabilitiesStrip = [
  {
    num: '01',
    title: 'VOICE INTERVIEWS',
    desc: 'Speak naturally.',
  },
  {
    num: '02',
    title: 'RESUME MATCHING',
    desc: 'Find skill gaps.',
  },
  {
    num: '03',
    title: 'TECHNICAL QUESTIONS',
    desc: 'Test your knowledge.',
  },
  {
    num: '04',
    title: 'AI FEEDBACK',
    desc: 'Improve every answer.',
  },
];

// ─── Phase 4: How It Works Steps ─────────────────────────────────────────────
const howItWorksMoves = [
  {
    num: '01',
    title: 'CHOOSE YOUR ROLE',
    desc: "Pick the interview you're preparing for.",
    detail: 'Frontend, Backend, System Design, or custom JD.',
  },
  {
    num: '02',
    title: 'ANSWER OUT LOUD',
    desc: 'Face questions from Shristi AI.',
    detail: 'Real-time voice transcription with adaptive probes.',
  },
  {
    num: '03',
    title: 'GET YOUR BREAKDOWN',
    desc: 'Understand what worked and what needs improvement.',
    detail: 'Scorecards, missed concepts, and model answers.',
  },
];

// ─── Phase 5: Interview Experience Modes ─────────────────────────────────────
const experienceModes = [
  {
    id: 'voice',
    num: '01',
    title: 'TALK TO SHRISTI',
    tagline: 'Answer interview questions out loud.',
    badge: 'VOICE ROOM • LIVE AUDIO',
    orbState: 'speaking',
    question:
      '“You listed Redis Pub/Sub on your resume. What happens to in-flight orders if a worker node crashes mid-processing?”',
    transcript:
      '“Standard Pub/Sub is fire-and-forget. We migrated to Redis Streams with consumer groups and explicit XACK acknowledgments so surviving workers claim and replay pending messages.”',
    verdict: 'Optimal Recovery Pattern',
    score: '9.3 / 10',
    feedback:
      'Identified at-most-once limitation of Pub/Sub and explained stream consumer groups.',
  },
  {
    id: 'resume',
    num: '02',
    title: 'MATCH YOUR RESUME',
    tagline: 'See how your experience fits a role.',
    badge: 'RESUME PARSER • ATS MATCH',
    orbState: 'evaluating',
    question:
      '“The job description requires distributed rate-limiting, which is missing from your resume. How would you design one?”',
    transcript:
      '“I would implement a sliding-window counter in Redis with an atomic Lua script, backed by an in-memory token bucket at the API gateway to absorb burst spikes.”',
    verdict: 'Gap Defended Live',
    score: '9.1 / 10',
    feedback:
      'Verbal explanation demonstrated practical knowledge despite the missing resume keyword.',
  },
  {
    id: 'skills',
    num: '03',
    title: 'TEST YOUR SKILLS',
    tagline: 'Practice technical questions under time limits.',
    badge: '90s TIMER • TECHNICAL DRILL',
    orbState: 'listening',
    question:
      '“In PostgreSQL Read Committed isolation, two concurrent updates hit the same row. How do you prevent lost updates?”',
    transcript:
      '“Use SELECT ... FOR UPDATE row-level locking, or an atomic UPDATE ... WHERE balance >= amount statement.”',
    verdict: 'Optimal Concurrency',
    score: '9.6 / 10',
    feedback:
      'Correctly cited both row-level pessimistic locking and single-statement atomic updates.',
  },
];

// ─── Phase 6: Practice Tracks (5 Supported Disciplines) ───────────────────────
const practiceTracks = [
  {
    num: '01',
    title: 'Frontend Engineering',
    route: '/mock-interview-for-react-developers',
    question: 'How does React 19 prioritize urgent input over heavy transitions?',
    topics: ['React 19', 'Hooks Architecture', 'Performance', 'Next.js'],
  },
  {
    num: '02',
    title: 'Backend Engineering',
    route: '/live-interview',
    question: 'How do you design an idempotent webhook receiver for Stripe retries?',
    topics: ['Node.js', 'PostgreSQL', 'Redis Locks', 'API Security'],
  },
  {
    num: '03',
    title: 'Data Structures and Algorithms',
    route: '/mock-interview-for-freshers',
    question: 'How do you detect a cycle in a directed graph and print the path?',
    topics: ['Big-O Analysis', 'Graphs & Trees', 'Dynamic Programming', 'MCQs'],
  },
  {
    num: '04',
    title: 'System Design',
    route: '/system-design-mock-interview',
    question: 'Design a multi-region rate limiter handling 1,000,000 RPS sub-5ms.',
    topics: ['Capacity Math', 'Distributed Caching', 'Partitioning', 'CAP Theorem'],
  },
  {
    num: '05',
    title: 'HR and Behavioral',
    route: '/resume-based-interview-questions',
    question: 'Tell me about a production outage you caused. How did you resolve it?',
    topics: ['STAR Stories', 'Resume Defense', 'Leadership', 'Conflict'],
  },
];

// ─── Phase 7: Performance Report Data (Asymmetric Hierarchy) ─────────────────
const performanceReports = [
  {
    id: 'r1',
    code: 'REPORT 01',
    role: 'Frontend Engineering',
    question: 'How does React 19 concurrent rendering prioritize urgent user input?',
    overallScore: '92',
    depth: '9.4 / 10',
    clarity: '9.1 / 10',
    whatWorked: 'Distinguished SyncLane urgent updates from interruptible TransitionLane work.',
    whatToImprove: 'Mention lane expiration timestamps to prevent continuous input starvation.',
    modelUpgrade: 'To make this Staff-level, add that expired lanes are automatically escalated to synchronous execution.',
  },
  {
    id: 'r2',
    code: 'REPORT 02',
    role: 'Backend Engineering',
    question: 'When does a composite B-tree index hurt database throughput?',
    overallScore: '89',
    depth: '8.9 / 10',
    clarity: '9.0 / 10',
    whatWorked: 'Accurately cited PostgreSQL Heap-Only Tuple (HOT) update invalidation.',
    whatToImprove: 'Consider partial indexes (WHERE clause) to keep the index compact.',
    modelUpgrade: 'Recommend partial indexes on active states (e.g. status = "pending") to reduce write volume by 80%.',
  },
  {
    id: 'r3',
    code: 'REPORT 03',
    role: 'System Design',
    question: 'How do you recover if a payment call succeeds but the local DB fails?',
    overallScore: '94',
    depth: '9.5 / 10',
    clarity: '9.2 / 10',
    whatWorked: 'Combined the Transactional Outbox pattern with asynchronous webhook replay.',
    whatToImprove: 'State the reconciliation retry interval and exponential backoff ceiling.',
    modelUpgrade: 'Recording the state transition intent prior to external RPCs guarantees eventual consistency.',
  },
];

// ─── Phase 8: Editorial FAQ Items ────────────────────────────────────────────
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

// ─── Audio Waveform Visual ───────────────────────────────────────────────────
const WaveformBar = ({ active = true }) => {
  const heights = [30, 60, 40, 85, 95, 50, 70, 90, 40, 75, 100, 60, 45, 85, 65, 40, 80, 55, 90, 45, 65, 35, 70, 45];
  return (
    <div className="flex items-center gap-[3px] h-6 px-1" aria-label="Live audio frequency">
      {heights.map((h, i) => (
        <motion.span
          key={i}
          animate={
            active
              ? {
                  height: [`${Math.max(20, h * 0.4)}%`, `${h}%`, `${Math.max(25, h * 0.55)}%`],
                }
              : { height: '24%' }
          }
          transition={{
            repeat: Infinity,
            duration: 0.85 + (i % 4) * 0.15,
            ease: 'easeInOut',
          }}
          className="w-[2.5px] rounded-full"
          style={{
            backgroundColor: i % 4 === 0 ? '#C7F36B' : i % 2 === 0 ? '#FF6B35' : '#FFFFFF',
            opacity: active ? 0.9 : 0.35,
          }}
        />
      ))}
    </div>
  );
};

const Landing = () => {
  const containerRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [modeIdx, setModeIdx] = useState(0);
  const [hoverTrackIdx, setHoverTrackIdx] = useState(0);
  const [reportIdx, setReportIdx] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const { theme, toggleTheme } = useTheme();

  // Optimized scroll elevation listener
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── GSAP & ScrollTrigger Scoped Animations ─────────────────────────────────
  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Reduced motion bypass
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(
          [
            '.hero-eyebrow',
            '.hero-line-inner',
            '.hero-subtext',
            '.hero-cta-btn',
            '.hero-preview-frame',
            '.capability-col',
            '.how-it-works-head',
            '.move-item',
            '.experience-head',
            '.experience-tab-btn',
            '.experience-stage-card',
            '.tracks-head',
            '.track-row',
            '.report-head',
            '.report-card-container',
            '.faq-head',
            '.faq-row',
            '.footer-cta-head',
            '.footer-col',
          ],
          { opacity: 1, x: 0, y: 0, clearProps: 'all' }
        );
      });

      // Desktop & Tablet Animation Suite (>= 768px)
      mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
        // Hero Reveal Timeline
        const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        heroTl
          .from('.hero-eyebrow', { opacity: 0, y: -8, duration: 0.4 })
          .from(
            '.hero-line-inner',
            {
              yPercent: 110,
              duration: 0.85,
              stagger: 0.12,
              ease: 'power4.out',
            },
            '-=0.2'
          )
          .from(
            '.hero-accent-word',
            {
              scale: 0.92,
              opacity: 0,
              duration: 0.5,
              ease: 'power2.out',
            },
            '-=0.45'
          )
          .from('.hero-subtext', { opacity: 0, y: 14, duration: 0.5 }, '-=0.35')
          .from(
            '.hero-cta-btn',
            {
              opacity: 0,
              y: 12,
              stagger: 0.08,
              duration: 0.45,
            },
            '-=0.3'
          )
          .from(
            '.hero-preview-frame',
            {
              opacity: 0,
              y: 28,
              duration: 0.7,
              ease: 'power3.out',
            },
            '-=0.45'
          );

        // Capabilities Stagger
        gsap.from('.capability-col', {
          scrollTrigger: {
            trigger: '#capabilities',
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
          opacity: 0,
          y: 18,
          duration: 0.5,
          stagger: 0.08,
          ease: 'power2.out',
        });

        // How It Works: Connected timeline
        const movesTl = gsap.timeline({
          scrollTrigger: {
            trigger: '#how-it-works',
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
          defaults: { ease: 'power3.out' },
        });

        movesTl
          .from('.how-it-works-head', { opacity: 0, y: 18, duration: 0.55 })
          .from(
            '.timeline-connector-bar',
            { scaleX: 0, transformOrigin: 'left center', duration: 0.6, ease: 'power2.inOut' },
            '-=0.2'
          )
          .from(
            '.move-item',
            {
              opacity: 0,
              y: 20,
              stagger: 0.12,
              duration: 0.6,
            },
            '-=0.3'
          );

        // Experience (Live Simulator)
        const expTl = gsap.timeline({
          scrollTrigger: {
            trigger: '#experience',
            start: 'top 75%',
            toggleActions: 'play none none reverse',
          },
          defaults: { ease: 'power3.out' },
        });

        expTl
          .from('.experience-head', { opacity: 0, y: 18, duration: 0.55 })
          .from(
            '.experience-tab-btn',
            {
              opacity: 0,
              x: -14,
              stagger: 0.08,
              duration: 0.45,
            },
            '-=0.25'
          )
          .from(
            '.experience-stage-card',
            {
              opacity: 0,
              y: 24,
              duration: 0.65,
            },
            '-=0.35'
          );

        // Practice Tracks
        const tracksTl = gsap.timeline({
          scrollTrigger: {
            trigger: '#tracks',
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
          defaults: { ease: 'power2.out' },
        });

        tracksTl
          .from('.tracks-head', { opacity: 0, y: 18, duration: 0.55 })
          .from(
            '.track-row',
            {
              opacity: 0,
              y: 16,
              stagger: 0.07,
              duration: 0.45,
            },
            '-=0.25'
          );

        // Report Scorecard
        const reportTl = gsap.timeline({
          scrollTrigger: {
            trigger: '#report',
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
          defaults: { ease: 'power3.out' },
        });

        reportTl
          .from('.report-head', { opacity: 0, y: 18, duration: 0.55 })
          .from(
            '.report-card-container',
            {
              opacity: 0,
              y: 22,
              duration: 0.6,
            },
            '-=0.3'
          );

        // FAQ Section
        const faqTl = gsap.timeline({
          scrollTrigger: {
            trigger: '#faq',
            start: 'top 82%',
            toggleActions: 'play none none reverse',
          },
          defaults: { ease: 'power2.out' },
        });

        faqTl
          .from('.faq-head', { opacity: 0, y: 18, duration: 0.5 })
          .from('.faq-row', { opacity: 0, y: 14, stagger: 0.08, duration: 0.45 }, '-=0.25');

        // Warm Cream Footer Entrance
        const footerTl = gsap.timeline({
          scrollTrigger: {
            trigger: '#footer',
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
          defaults: { ease: 'power3.out' },
        });

        footerTl
          .from('.footer-cta-head', { opacity: 0, y: 18, duration: 0.55 })
          .from('.footer-col', { opacity: 0, y: 14, stagger: 0.08, duration: 0.5 }, '-=0.3');
      });

      // Mobile Responsive Suite (< 768px)
      mm.add('(max-width: 767px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.from('.hero-line-inner', {
          yPercent: 100,
          duration: 0.65,
          stagger: 0.09,
          ease: 'power3.out',
        });
        gsap.from('.hero-preview-frame', {
          opacity: 0,
          y: 18,
          duration: 0.55,
          delay: 0.2,
        });

        ['#capabilities', '#how-it-works', '#experience', '#tracks', '#report', '#faq', '#footer'].forEach(
          (id) => {
            gsap.from(id, {
              scrollTrigger: {
                trigger: id,
                start: 'top 88%',
                toggleActions: 'play none none reverse',
              },
              opacity: 0,
              y: 16,
              duration: 0.5,
              ease: 'power2.out',
            });
          }
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Smooth anchor navigation offset for sticky header
  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const navHeight = 72;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - navHeight,
        behavior: 'smooth',
      });
    }
  };

  const currentHero = heroSessions[heroIdx];
  const currentMode = experienceModes[modeIdx];
  const currentReport = performanceReports[reportIdx];

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-bg-canvas text-text-primary font-body selection:bg-[#FF6B35] selection:text-white overflow-x-clip"
    >
      <SEOHead
        title="Evalix — Practice Technical & Voice Interviews with AI"
        description="Practice AI voice mock interviews, scan your PDF resume against job descriptions, and take timed technical MCQ assessments."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/"
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          PHASE 1 — NAVBAR (Refined Editorial Header, Generous Link Spacing)
         ═══════════════════════════════════════════════════════════════════════ */}
      <header
        className={`sticky top-0 z-50 w-full transition-colors duration-200 border-b border-border-subtle ${
          scrolled ? 'bg-bg-canvas/95 backdrop-blur-md shadow-xs' : 'bg-bg-canvas'
        }`}
      >
        <div
          className={`max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12 flex items-center justify-between transition-all duration-200 ${
            scrolled ? 'h-16' : 'h-20'
          }`}
        >
          {/* Left: Brand */}
          <div className="flex items-baseline gap-2.5">
            <Link
              to="/"
              className="text-2xl font-display font-bold tracking-[-0.04em] text-text-primary hover:text-[#FF6B35] transition-colors"
            >
              Evalix
            </Link>
            <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              STUDIO
            </span>
          </div>

          {/* Center: Primary Links with Generous Spacing */}
          <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-9">
            {[
              { label: 'Capabilities', target: 'capabilities', num: '01' },
              { label: 'How It Works', target: 'how-it-works', num: '02' },
              { label: 'Experience', target: 'experience', num: '03' },
              { label: 'Tracks', target: 'tracks', num: '04' },
              { label: 'Report', target: 'report', num: '05' },
              { label: 'FAQ', target: 'faq', num: '06' },
            ].map((item) => (
              <button
                key={item.target}
                type="button"
                onClick={() => scrollToSection(item.target)}
                className="group inline-flex items-baseline gap-1.5 py-2 text-sm font-display font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <span className="font-mono text-[10px] text-text-muted group-hover:text-[#FF6B35] transition-colors">
                  {item.num}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] border border-border-subtle bg-bg-surface/60 text-text-secondary hover:text-text-primary hover:border-text-primary transition-colors cursor-pointer"
              aria-label="Toggle color theme"
            >
              {theme === 'light' ? <FiMoon size={15} /> : <FiSun size={15} />}
            </button>

            <SignedIn>
              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/dashboard"
                  className="hidden sm:inline-flex items-center gap-2 px-4.5 min-h-[40px] bg-[#151515] text-[#F4F0E8] dark:bg-[#F4F0E8] dark:text-[#151515] font-display font-semibold text-xs uppercase tracking-[0.12em] hover:bg-[#FF6B35] hover:text-white dark:hover:bg-[#FF6B35] dark:hover:text-white transition-colors"
                >
                  <span>Dashboard</span>
                  <FiArrowUpRight size={14} />
                </Link>
              </motion.div>
              <div className="pl-1 flex items-center">
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>

            <SignedOut>
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center px-3 min-h-[40px] text-xs font-mono uppercase tracking-[0.12em] text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign In
              </Link>
              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/register"
                  className="hidden sm:inline-flex items-center gap-1.5 px-4.5 min-h-[40px] bg-[#151515] text-[#F4F0E8] dark:bg-[#FF6B35] dark:text-white font-display font-semibold text-xs uppercase tracking-[0.12em] hover:bg-[#FF6B35] hover:text-white transition-colors"
                >
                  <span>Start Interview</span>
                  <FiArrowUpRight size={14} />
                </Link>
              </motion.div>
            </SignedOut>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden inline-flex items-center justify-center min-w-[42px] min-h-[42px] border border-border-subtle bg-bg-surface text-text-primary cursor-pointer"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <FiX size={18} /> : <FiMenu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="lg:hidden border-t border-border-subtle bg-bg-canvas overflow-hidden"
            >
              <div className="max-w-[1380px] mx-auto px-5 py-5 divide-y divide-border-subtle">
                <div className="pb-3 space-y-1">
                  {[
                    { label: 'Capabilities', target: 'capabilities', num: '01' },
                    { label: 'How It Works', target: 'how-it-works', num: '02' },
                    { label: 'Experience', target: 'experience', num: '03' },
                    { label: 'Tracks', target: 'tracks', num: '04' },
                    { label: 'Report', target: 'report', num: '05' },
                    { label: 'FAQ', target: 'faq', num: '06' },
                  ].map((item) => (
                    <button
                      key={item.target}
                      type="button"
                      onClick={() => scrollToSection(item.target)}
                      className="w-full py-2 flex items-baseline justify-between text-left font-display text-base font-bold text-text-primary hover:text-[#FF6B35] transition-colors cursor-pointer"
                    >
                      <span>{item.label}</span>
                      <span className="font-mono text-xs text-text-muted">{item.num}</span>
                    </button>
                  ))}
                </div>
                <div className="pt-4 flex flex-col sm:flex-row gap-2.5">
                  <SignedIn>
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#151515] text-[#F4F0E8] font-display font-semibold text-xs uppercase tracking-[0.14em]"
                    >
                      <span>Open Dashboard</span>
                      <FiArrowRight size={14} />
                    </Link>
                  </SignedIn>
                  <SignedOut>
                    <Link
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#FF6B35] text-white font-display font-semibold text-xs uppercase tracking-[0.14em]"
                    >
                      <span>Start Interview</span>
                      <FiArrowRight size={14} />
                    </Link>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full min-h-[44px] inline-flex items-center justify-center border border-border-subtle bg-bg-surface text-text-primary font-display font-semibold text-xs uppercase tracking-[0.14em]"
                    >
                      Sign In
                    </Link>
                  </SignedOut>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="main-content">
        {/* ═════════════════════════════════════════════════════════════════════
            PHASE 2 — HERO & PRODUCT PREVIEW (Refined Asymmetric Composition)
           ═════════════════════════════════════════════════════════════════════ */}
        <section id="hero" className="relative pt-8 pb-14 lg:pt-12 lg:pb-20 border-b border-border-subtle">
          <div className="hero-content-wrap max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12">
            {/* Eyebrow metadata */}
            <div className="hero-eyebrow flex items-center justify-between pb-5 mb-8 border-b border-border-subtle font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#FF6B35]" />
                <span>EVALIX STUDIO / AI INTERVIEW EXPERIENCE</span>
              </div>
              <span className="hidden sm:inline">VOICE &bull; RESUME &bull; RUBRIC</span>
            </div>

            {/* Display Headline */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end mb-10 lg:mb-12">
              <div className="lg:col-span-8">
                <h1 className="font-display font-bold uppercase tracking-[-0.045em] text-text-primary text-[clamp(2.9rem,7.2vw,6.8rem)] leading-[0.92]">
                  <span className="block overflow-hidden pb-1">
                    <span className="hero-line-inner block">THE INTERVIEW</span>
                  </span>
                  <span className="block overflow-hidden pb-1">
                    <span className="hero-line-inner block">
                      IS A{' '}
                      <span className="hero-accent-word inline-block font-serif-editorial italic font-normal text-[#FF6B35] pr-1">
                        SKILL.
                      </span>
                    </span>
                  </span>
                  <span className="block overflow-hidden pb-1">
                    <span className="hero-line-inner block">TRAIN IT.</span>
                  </span>
                </h1>
              </div>

              {/* Supporting Copy & CTAs */}
              <div className="lg:col-span-4 lg:pb-2 space-y-4">
                <p className="hero-subtext text-base sm:text-lg text-text-secondary leading-snug">
                  Practice out loud with AI. Get better with every answer.
                </p>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <SignedIn>
                    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="hero-cta-btn">
                      <Link
                        to="/live-interview"
                        className="px-6 min-h-[48px] bg-[#FF6B35] text-white font-display font-bold text-xs uppercase tracking-[0.14em] inline-flex items-center gap-2 hover:bg-[#151515] transition-colors"
                      >
                        <span>START INTERVIEW</span>
                        <FiArrowRight size={15} />
                      </Link>
                    </motion.div>
                  </SignedIn>
                  <SignedOut>
                    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="hero-cta-btn">
                      <Link
                        to="/register"
                        className="px-6 min-h-[48px] bg-[#FF6B35] text-white font-display font-bold text-xs uppercase tracking-[0.14em] inline-flex items-center gap-2 hover:bg-[#151515] transition-colors"
                      >
                        <span>START INTERVIEW</span>
                        <FiArrowRight size={15} />
                      </Link>
                    </motion.div>
                  </SignedOut>

                  <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="hero-cta-btn">
                    <button
                      type="button"
                      onClick={() => scrollToSection('tracks')}
                      className="px-5 min-h-[48px] border border-border-subtle bg-bg-surface text-text-primary font-display font-bold text-xs uppercase tracking-[0.14em] inline-flex items-center gap-1.5 hover:border-text-primary transition-colors cursor-pointer"
                    >
                      <span>EXPLORE TRACKS</span>
                      <span className="font-mono text-[11px]">&darr;</span>
                    </button>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Refined Integrated Product Visual (Thin Surrounding Frame, Balanced Contrast) */}
            <div className="hero-preview-frame border border-border-subtle bg-[#161616] text-[#F4F0E8] shadow-sm">
              {/* Top Studio Meta Bar */}
              <div className="px-5 sm:px-6 py-3 border-b border-[#262626] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#C7F36B]" />
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-white font-semibold">
                    SHRISTI AI // {currentHero.role}
                  </span>
                </div>

                {/* Session Pill Selector */}
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  {heroSessions.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setHeroIdx(idx)}
                      className={`px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                        heroIdx === idx
                          ? 'bg-[#FF6B35] text-white font-bold'
                          : 'bg-[#222222] text-[#B5AFA6] hover:text-white'
                      }`}
                    >
                      {s.track}
                    </button>
                  ))}
                </div>
              </div>

              {/* Workspace Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentHero.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                >
                  {/* Left 8 Cols: Prompt & Spoken Transcript */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="p-4 bg-[#1E1E1E] border-l-2 border-[#FF6B35] space-y-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#B5AFA6] block">
                        CURRENT QUESTION
                      </span>
                      <p className="font-display font-semibold text-base sm:text-lg text-white leading-snug">
                        &ldquo;{currentHero.question}&rdquo;
                      </p>
                    </div>

                    <div className="p-4 bg-[#1A1A1A] border border-[#262626] space-y-1.5">
                      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
                        <span className="text-[#C7F36B]">CANDIDATE RESPONSE</span>
                        <span className="text-[#B5AFA6]">MIC ACTIVE</span>
                      </div>
                      <p className="text-sm text-[#E5E0D8] leading-relaxed">
                        &ldquo;{currentHero.candidateTranscript}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Right 4 Cols: Live Signals & Metrics */}
                  <div className="lg:col-span-4 p-4 bg-[#1A1A1A] border border-[#262626] space-y-4">
                    <div className="flex items-center justify-between border-b border-[#262626] pb-2">
                      <div className="flex items-center gap-2">
                        <EvalixOrb state="listening" size="sm" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#B5AFA6]">
                          RUBRIC EVALUATION
                        </span>
                      </div>
                      <WaveformBar active />
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      {currentHero.metrics.map((m) => (
                        <div key={m.label} className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-[#B5AFA6]">{m.label}</span>
                            <span className="text-white font-bold">{m.score}/10</span>
                          </div>
                          <div className="h-1 bg-[#262626]">
                            <div
                              className="h-full transition-all duration-300"
                              style={{ width: `${m.bar}%`, backgroundColor: m.accent }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[#262626]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#B5AFA6] block mb-1.5">
                        DETECTED CONCEPTS
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentHero.signals.map((sig) => (
                          <span
                            key={sig}
                            className="px-2 py-0.5 bg-[#222222] border border-[#333333] font-mono text-[10px] text-[#F4F0E8]"
                          >
                            {sig}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════════════════════════════════
            PHASE 3 — CAPABILITIES STRIP (Compact, 4 Balanced Columns)
           ═════════════════════════════════════════════════════════════════════ */}
        <section
          id="capabilities"
          aria-label="Capabilities"
          className="bg-bg-elevated/40 border-b border-border-subtle"
        >
          <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle">
              {capabilitiesStrip.map((item) => (
                <div
                  key={item.num}
                  className="capability-col py-6 sm:px-6 first:sm:pl-0 last:sm:pr-0 space-y-1 group"
                >
                  <div className="flex items-center justify-between font-mono text-[11px] text-text-muted">
                    <span>/{item.num}</span>
                    <span className="text-[#FF6B35] opacity-0 group-hover:opacity-100 transition-opacity">
                      &bull;
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-base sm:text-lg tracking-[-0.03em] text-text-primary">
                    {item.title}
                  </h2>
                  <p className="text-sm text-text-secondary leading-snug">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════════════════════════════════
            PHASE 4 — HOW IT WORKS (Connected Journey Timeline)
           ═════════════════════════════════════════════════════════════════════ */}
        <section
          id="how-it-works"
          className="py-16 lg:py-24 bg-bg-canvas border-b border-border-subtle"
        >
          <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12">
            {/* Header */}
            <div className="how-it-works-head max-w-2xl mb-12 space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-[#FF6B35] block">
                HOW IT WORKS
              </span>
              <h2 className="font-display font-bold uppercase tracking-[-0.04em] text-3xl sm:text-4xl text-text-primary">
                THREE MOVES. BETTER ANSWERS.
              </h2>
              <p className="text-sm sm:text-base text-text-secondary">
                Go from a target role to a scored session in minutes.
              </p>
            </div>

            {/* Connecting Timeline Bar (Desktop) */}
            <div className="relative">
              <div className="hidden md:block absolute top-[28px] left-0 right-0 h-[1.5px] bg-border-subtle">
                <div className="timeline-connector-bar h-full bg-[#FF6B35] w-full" />
              </div>

              {/* Three Connected Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 pt-2">
                {howItWorksMoves.map((m) => (
                  <div
                    key={m.num}
                    className="move-item relative space-y-3 bg-bg-canvas pt-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-10 h-10 border border-[#151515] bg-[#151515] text-white dark:bg-[#F4F0E8] dark:text-[#151515] font-mono text-sm font-bold shrink-0">
                        {m.num}
                      </span>
                      <span className="h-[1px] flex-1 bg-border-subtle md:hidden" />
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <h3 className="font-display font-bold text-xl text-text-primary">
                        {m.title}
                      </h3>
                      <p className="text-sm sm:text-base text-text-primary font-medium leading-snug">
                        {m.desc}
                      </p>
                      <p className="text-xs text-text-muted leading-relaxed">
                        {m.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════════════════════════════════
            PHASE 5 — INTERVIEW EXPERIENCE (Product Demonstration)
           ═════════════════════════════════════════════════════════════════════ */}
        <section
          id="experience"
          className="py-16 lg:py-24 bg-bg-canvas border-b border-border-subtle"
        >
          <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12">
            {/* Header */}
            <div className="experience-head grid grid-cols-1 lg:grid-cols-12 gap-6 items-end mb-10">
              <div className="lg:col-span-8 space-y-2">
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-[#FF6B35] block">
                  LIVE SIMULATOR
                </span>
                <h2 className="font-display font-bold uppercase tracking-[-0.04em] text-3xl sm:text-5xl text-text-primary">
                  PRACTICE. DON&apos;T JUST PREPARE.
                </h2>
              </div>
              <div className="lg:col-span-4 lg:text-right">
                <p className="text-sm text-text-secondary">
                  Spoken technical rounds with live follow-ups. No static scripts.
                </p>
              </div>
            </div>

            {/* Asymmetrical Layout: Left 4-Col Steps + Right 8-Col Interface Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Selectable Steps */}
              <div className="lg:col-span-4 divide-y divide-border-subtle border-y border-border-subtle">
                {experienceModes.map((exp, idx) => {
                  const active = modeIdx === idx;
                  return (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => setModeIdx(idx)}
                      className={`experience-tab-btn w-full py-5 px-4 text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-bg-surface border-l-3 border-[#FF6B35]'
                          : 'hover:bg-bg-surface/50'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-xs mb-1">
                        <span className={active ? 'text-[#FF6B35] font-bold' : 'text-text-muted'}>
                          /{exp.num}
                        </span>
                        {active && (
                          <span className="px-2 py-0.5 bg-[#C7F36B] text-[#151515] font-bold text-[10px]">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-lg text-text-primary">
                        {exp.title}
                      </h3>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {exp.tagline}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Right Interface Preview */}
              <div className="experience-stage-card lg:col-span-8 border border-border-subtle bg-[#161616] text-[#F4F0E8] shadow-sm">
                <div className="px-5 sm:px-6 py-3 border-b border-[#262626] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#C7F36B]" />
                    <span className="font-mono text-xs uppercase tracking-[0.14em] text-white">
                      {currentMode.badge}
                    </span>
                  </div>
                  <WaveformBar active />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentMode.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="p-5 sm:p-7 space-y-5"
                  >
                    {/* Prompt Box */}
                    <div className="p-4 bg-[#1E1E1E] border-l-2 border-[#FF6B35] space-y-1">
                      <div className="flex items-center gap-2 mb-1">
                        <EvalixOrb state={currentMode.orbState} size="sm" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#FF6B35]">
                          SHRISTI (INTERVIEWER)
                        </span>
                      </div>
                      <p className="font-display font-semibold text-base sm:text-lg text-white leading-snug">
                        {currentMode.question}
                      </p>
                    </div>

                    {/* Candidate Response */}
                    <div className="p-4 bg-[#1A1A1A] border border-[#262626] space-y-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#C7F36B] block">
                        CANDIDATE SPOKEN DEFENSE
                      </span>
                      <p className="font-serif-editorial italic text-base sm:text-lg text-[#F4F0E8] leading-snug">
                        {currentMode.transcript}
                      </p>
                    </div>

                    {/* Live Evaluation Strip */}
                    <div className="p-3.5 bg-[#181818] border border-[#262626] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                      <div>
                        <span className="text-[#B5AFA6] block text-[10px]">VERDICT</span>
                        <span className="text-white font-bold">{currentMode.verdict}</span>
                      </div>
                      <div>
                        <span className="text-[#B5AFA6] block text-[10px]">RUBRIC SCORE</span>
                        <span className="text-[#C7F36B] font-bold">{currentMode.score}</span>
                      </div>
                      <div className="text-right max-w-xs font-sans text-xs text-[#B5AFA6]">
                        {currentMode.feedback}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════════════════════════════════
            PHASE 6 — PRACTICE TRACKS (Editorial Ledger with Hover Interactions)
           ═════════════════════════════════════════════════════════════════════ */}
        <section
          id="tracks"
          className="py-16 lg:py-24 bg-bg-canvas border-b border-border-subtle"
        >
          <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12">
            <div className="tracks-head max-w-2xl mb-10 space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-[#FF6B35] block">
                PRACTICE TRACKS
              </span>
              <h2 className="font-display font-bold uppercase tracking-[-0.04em] text-3xl sm:text-4xl text-text-primary">
                PICK YOUR CHALLENGE.
              </h2>
              <p className="text-sm sm:text-base text-text-secondary">
                Five focused interview tracks.
              </p>
            </div>

            {/* Editorial Rows */}
            <div className="border-t border-text-primary">
              {practiceTracks.map((track, idx) => {
                const isHovered = hoverTrackIdx === idx;
                return (
                  <div
                    key={track.num}
                    onMouseEnter={() => setHoverTrackIdx(idx)}
                    className={`track-row border-b border-border-subtle transition-colors duration-150 ${
                      isHovered ? 'bg-bg-surface' : 'hover:bg-bg-surface/50'
                    }`}
                  >
                    <div className="py-5 sm:py-6 px-3 sm:px-4 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6 items-center">
                      <div className="lg:col-span-1">
                        <span
                          className={`font-mono text-xs font-bold ${
                            isHovered ? 'text-[#FF6B35]' : 'text-text-muted'
                          }`}
                        >
                          /{track.num}
                        </span>
                      </div>

                      <div className="lg:col-span-4">
                        <Link
                          to={track.route}
                          className="font-display font-bold text-xl sm:text-2xl text-text-primary hover:text-[#FF6B35] transition-colors"
                        >
                          {track.title}
                        </Link>
                      </div>

                      <div className="lg:col-span-5 space-y-1.5">
                        <p className="font-serif-editorial italic text-sm sm:text-base text-text-secondary leading-snug">
                          &ldquo;{track.question}&rdquo;
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {track.topics.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 border border-border-subtle font-mono text-[10px] text-text-muted bg-bg-canvas"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="lg:col-span-2 lg:text-right pt-2 lg:pt-0">
                        <motion.div
                          whileHover={{ x: 3 }}
                          whileTap={{ scale: 0.98 }}
                          className="inline-block"
                        >
                          <Link
                            to={track.route}
                            className={`inline-flex items-center gap-1.5 px-4 min-h-[40px] font-display font-semibold text-xs uppercase tracking-[0.12em] transition-colors ${
                              isHovered
                                ? 'bg-[#151515] text-[#F4F0E8] dark:bg-[#FF6B35] dark:text-white'
                                : 'border border-border-subtle text-text-primary'
                            }`}
                          >
                            <span>Practice</span>
                            <FiArrowUpRight size={14} />
                          </Link>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════════════════════════════════
            PHASE 7 — PERFORMANCE REPORT (Asymmetric Hierarchy)
           ═════════════════════════════════════════════════════════════════════ */}
        <section
          id="report"
          className="py-16 lg:py-24 bg-bg-canvas border-b border-border-subtle"
        >
          <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12">
            <div className="report-head grid grid-cols-1 lg:grid-cols-12 gap-6 items-end mb-10">
              <div className="lg:col-span-7 space-y-2">
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-[#FF6B35] block">
                  SESSION REPORT
                </span>
                <h2 className="font-display font-bold uppercase tracking-[-0.04em] text-3xl sm:text-4xl text-text-primary">
                  KNOW WHAT TO FIX.
                </h2>
                <p className="text-sm sm:text-base text-text-secondary">
                  Actionable rubrics on every answer so you know where you stand.
                </p>
              </div>

              {/* Report Tab Selector */}
              <div className="lg:col-span-5 flex flex-wrap lg:justify-end gap-2">
                {performanceReports.map((r, idx) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReportIdx(idx)}
                    className={`report-tab-btn px-3.5 min-h-[38px] font-mono text-xs uppercase tracking-wider border transition-colors cursor-pointer ${
                      reportIdx === idx
                        ? 'bg-[#151515] text-white border-[#151515] dark:bg-[#F4F0E8] dark:text-[#151515]'
                        : 'bg-bg-surface text-text-secondary border-border-subtle hover:text-text-primary'
                    }`}
                  >
                    {r.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Asymmetric Report Presentation */}
            <div className="report-card-container">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentReport.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="border border-border-subtle bg-bg-surface p-6 sm:p-8 space-y-6 shadow-xs"
                >
                  {/* Question header */}
                  <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-border-subtle">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted block">
                        DIAGNOSTIC SCORECARD // {currentReport.role}
                      </span>
                      <h3 className="font-display font-bold text-lg sm:text-xl text-text-primary mt-0.5">
                        &ldquo;{currentReport.question}&rdquo;
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-[#FF6B35] font-bold">
                      {currentReport.code}
                    </span>
                  </div>

                  {/* Asymmetric 12-Column Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* Main Score Hero Card (4 Cols) */}
                    <div className="lg:col-span-4 p-6 bg-[#161616] text-[#F4F0E8] border border-[#262626] flex flex-col justify-between space-y-6">
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#B5AFA6] block">
                          PERFORMANCE SCORE
                        </span>
                        <div className="flex items-baseline gap-1 pt-1">
                          <span className="font-display font-bold text-6xl text-[#C7F36B] tracking-tight">
                            {currentReport.overallScore}
                          </span>
                          <span className="font-mono text-lg text-[#B5AFA6]">/100</span>
                        </div>
                      </div>

                      <div className="space-y-2 pt-4 border-t border-[#262626] font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#B5AFA6]">Depth</span>
                          <span className="text-white font-bold">{currentReport.depth}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#B5AFA6]">Clarity</span>
                          <span className="text-white font-bold">{currentReport.clarity}</span>
                        </div>
                      </div>
                    </div>

                    {/* Supporting Metrics & Improvement Breakdown (8 Cols) */}
                    <div className="lg:col-span-8 flex flex-col justify-between gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* What Worked */}
                        <div className="p-4 bg-bg-canvas border-l-2 border-[#C7F36B] space-y-1">
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted block">
                            + WHAT WORKED
                          </span>
                          <p className="text-xs sm:text-sm text-text-secondary leading-snug">
                            {currentReport.whatWorked}
                          </p>
                        </div>

                        {/* What to Improve */}
                        <div className="p-4 bg-bg-canvas border-l-2 border-[#FF6B35] space-y-1">
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#FF6B35] font-semibold block">
                            &Delta; FOCUS FOR NEXT SESSION
                          </span>
                          <p className="text-xs sm:text-sm text-text-secondary leading-snug">
                            {currentReport.whatToImprove}
                          </p>
                        </div>
                      </div>

                      {/* Reference Model Upgrade */}
                      <div className="p-4 border border-border-subtle bg-bg-canvas space-y-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted block">
                          REFERENCE MODEL ANSWER UPGRADE
                        </span>
                        <p className="font-serif-editorial italic text-sm sm:text-base text-text-primary leading-snug">
                          &ldquo;{currentReport.modelUpgrade}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════════════════════════════════
            PHASE 8 — FAQ (Balanced Two-Column Editorial Layout)
           ═════════════════════════════════════════════════════════════════════ */}
        <section id="faq" className="py-16 lg:py-24 bg-bg-canvas border-b border-border-subtle">
          <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              {/* Left Column: Eyebrow + Heading + Short Subtitle */}
              <div className="faq-head lg:col-span-5 space-y-3">
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-[#FF6B35] block">
                  QUESTIONS / ANSWERS
                </span>
                <h2 className="font-display font-bold uppercase tracking-[-0.035em] text-3xl sm:text-4xl text-text-primary leading-tight">
                  GOOD QUESTIONS.
                  <span className="block">CLEAR ANSWERS.</span>
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed max-w-sm">
                  Everything you need to know about live voice sessions, PDF resume defense, and scoring rubrics.
                </p>
              </div>

              {/* Right Column: Numbered Editorial Accordion */}
              <div className="lg:col-span-7 border-t border-text-primary">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div key={faq.q} className="faq-row border-b border-border-subtle">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                        className="w-full py-5 text-left flex items-center justify-between gap-4 cursor-pointer group"
                      >
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-xs text-text-muted">0{idx + 1}</span>
                          <span className="font-display font-semibold text-base sm:text-lg text-text-primary group-hover:text-[#FF6B35] transition-colors">
                            {faq.q}
                          </span>
                        </div>
                        <span className="text-text-primary shrink-0 transition-transform duration-200">
                          {isOpen ? <FiMinus size={16} /> : <FiPlus size={16} />}
                        </span>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pb-5 pl-7 text-sm text-text-secondary leading-relaxed max-w-2xl">
                              {faq.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═════════════════════════════════════════════════════════════════════
          PHASE 9 — COMPLETE WARM CREAM FOOTER REDESIGN
         ═════════════════════════════════════════════════════════════════════ */}
      <footer id="footer" className="bg-[#F4F0E8] dark:bg-[#151515] text-[#151515] dark:text-[#F4F0E8] pt-16 pb-12 transition-colors">
        <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12 space-y-14">
          {/* A. Closing Call to Action at Top of Footer */}
          <div className="footer-cta-head pb-14 border-b border-border-subtle grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8 space-y-3">
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-[#FF6B35] block">
                YOUR NEXT INTERVIEW STARTS HERE.
              </span>
              <h2 className="font-display font-bold uppercase tracking-[-0.04em] text-4xl sm:text-6xl text-text-primary leading-[0.92]">
                READY WHEN{' '}
                <span className="font-serif-editorial italic font-normal text-[#FF6B35]">
                  YOU ARE.
                </span>
              </h2>
              <p className="text-base text-text-secondary">
                &ldquo;One practice session can change your next answer.&rdquo;
              </p>
            </div>

            <div className="lg:col-span-4 flex justify-start lg:justify-end">
              <SignedIn>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/live-interview"
                    className="min-h-[50px] px-8 bg-[#FF6B35] text-white font-display font-bold text-xs uppercase tracking-[0.14em] inline-flex items-center gap-3 hover:bg-[#151515] dark:hover:bg-white dark:hover:text-[#151515] transition-colors"
                  >
                    <span>START PRACTICING</span>
                    <FiArrowUpRight size={16} />
                  </Link>
                </motion.div>
              </SignedIn>
              <SignedOut>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/register"
                    className="min-h-[50px] px-8 bg-[#FF6B35] text-white font-display font-bold text-xs uppercase tracking-[0.14em] inline-flex items-center gap-3 hover:bg-[#151515] dark:hover:bg-white dark:hover:text-[#151515] transition-colors"
                  >
                    <span>START PRACTICING</span>
                    <FiArrowUpRight size={16} />
                  </Link>
                </motion.div>
              </SignedOut>
            </div>
          </div>

          {/* B. Brand Area & C. Navigation Groups (3 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10">
            {/* Brand Statement (5 Cols) */}
            <div className="footer-col lg:col-span-5 space-y-3">
              <Link
                to="/"
                className="text-3xl font-display font-bold tracking-[-0.04em] text-text-primary block hover:text-[#FF6B35] transition-colors"
              >
                Evalix
              </Link>
              <p className="text-sm text-text-secondary leading-snug max-w-sm">
                AI interview practice, built for better answers.
              </p>
            </div>

            {/* EXPLORE (2 Cols) */}
            <div className="footer-col lg:col-span-2 space-y-3">
              <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-text-muted font-bold">
                EXPLORE
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-text-secondary">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('capabilities')}
                    className="hover:text-text-primary transition-colors cursor-pointer"
                  >
                    Capabilities
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works')}
                    className="hover:text-text-primary transition-colors cursor-pointer"
                  >
                    How It Works
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('experience')}
                    className="hover:text-text-primary transition-colors cursor-pointer"
                  >
                    Interview Experience
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('faq')}
                    className="hover:text-text-primary transition-colors cursor-pointer"
                  >
                    FAQ
                  </button>
                </li>
              </ul>
            </div>

            {/* PRACTICE (3 Cols) */}
            <div className="footer-col lg:col-span-3 space-y-3">
              <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-text-muted font-bold">
                PRACTICE
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-text-secondary">
                <li>
                  <Link
                    to="/mock-interview-for-react-developers"
                    className="hover:text-text-primary transition-colors"
                  >
                    Frontend Engineering
                  </Link>
                </li>
                <li>
                  <Link
                    to="/live-interview"
                    className="hover:text-text-primary transition-colors"
                  >
                    Backend Engineering
                  </Link>
                </li>
                <li>
                  <Link
                    to="/system-design-mock-interview"
                    className="hover:text-text-primary transition-colors"
                  >
                    System Design
                  </Link>
                </li>
                <li>
                  <Link
                    to="/resume-based-interview-questions"
                    className="hover:text-text-primary transition-colors"
                  >
                    HR &amp; Behavioral
                  </Link>
                </li>
              </ul>
            </div>

            {/* CONNECT (2 Cols) */}
            <div className="footer-col lg:col-span-2 space-y-3">
              <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-text-muted font-bold">
                CONNECT
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-text-secondary">
                <li>
                  <a
                    href="https://github.com/shubham574/Evalix"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors"
                  >
                    <FiGithub size={14} />
                    <span>GitHub</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com/in/shubham-maurya-937511309/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors"
                  >
                    <FiLinkedin size={14} />
                    <span>LinkedIn</span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:contact@evalix.ai"
                    className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors"
                  >
                    <FiMail size={14} />
                    <span>Contact</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* D. Legal & Copyright Row */}
          <div className="pt-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px] text-text-muted">
            <p>&copy; 2026 EVALIX. BUILT FOR BETTER INTERVIEWS.</p>
            <div className="flex items-center gap-4">
              <span>EDITORIAL TECH</span>
              <span>&bull;</span>
              <span>ALL RIGHTS RESERVED</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
