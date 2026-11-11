import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { useTheme } from '../hooks/useTheme';
import { motion, useScroll, useTransform, AnimatePresence, useReducedMotion } from 'motion/react';
import { 
  FiMenu, FiX, FiBriefcase, FiList, FiMessageSquare, 
  FiVideo, FiFileText, FiTrendingUp, FiArrowRight, FiCheckCircle,
  FiSun, FiMoon, FiGithub, FiLinkedin, FiChevronDown, FiHelpCircle
} from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';
import Preloader from '../components/ui/Preloader';
import MagneticButton from '../components/ui/MagneticButton';
import TiltCard from '../components/ui/TiltCard';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ─── Custom Hook for Scroll Reveal ───
const useScrollReveal = (threshold = 0.1) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isVisible];
};

// ─── Counter Animation Component ───
const AnimatedNumber = ({ end, duration = 2000, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const [ref, isVisible] = useScrollReveal(0.5);

  useEffect(() => {
    if (!isVisible) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
       setCount(end);
       return;
    }
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeProgress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [isVisible, end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

// ─── Hero Animation Component ───
const TypingIndicator = () => (
  <div className="flex space-x-1 items-center bg-bg-elevated px-3 py-2 rounded-2xl w-fit border border-border-subtle">
    <motion.div className="w-1.5 h-1.5 bg-text-secondary rounded-full" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }} />
    <motion.div className="w-1.5 h-1.5 bg-text-secondary rounded-full" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} />
    <motion.div className="w-1.5 h-1.5 bg-text-secondary rounded-full" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }} />
  </div>
);

const exchanges = [
  {
    q: "How would you optimize a slow React application?",
    a: "I'd use React.memo for pure components, useMemo for expensive calculations, and implement code splitting with React.lazy.",
    f: "Great answer! Practical and comprehensive. +10 pts"
  },
  {
    q: "What is the purpose of the useEffect hook?",
    a: "It allows you to perform side effects in functional components, like data fetching, subscriptions, or manual DOM manipulations.",
    f: "Spot on! Very clear explanation. +10 pts"
  },
  {
    q: "Can you explain the virtual DOM in React?",
    a: "It's a lightweight copy of the actual DOM. React compares it with the real DOM using a diffing algorithm, and updates only the changed parts.",
    f: "Excellent! You highlighted the diffing algorithm correctly. +10 pts"
  },
  {
    q: "What is the difference between state and props?",
    a: "Props are read-only and passed from parent to child, while state is local, mutable data managed within the component itself.",
    f: "Perfect distinction. Clear and concise. +10 pts"
  },
  {
    q: "How do you handle state management in a large application?",
    a: "I prefer using Context API for simple global state, and Redux or Zustand for more complex state logic with many updates.",
    f: "Good architectural sense! Solid reasoning. +10 pts"
  }
];

const HeroMockInterview = () => {
  const [exchangeIndex, setExchangeIndex] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => {
        if (s === 3) {
          setExchangeIndex(i => (i + 1) % exchanges.length);
          return 0; // Go back to question only
        }
        return s + 1;
      });
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const current = exchanges[exchangeIndex];

  return (
    <div className="relative w-full max-w-lg mx-auto bg-bg-surface border border-border-subtle rounded-2xl p-4 md:p-6 shadow-glow overflow-hidden h-[340px] flex flex-col">
      {/* Browser chrome */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-border-subtle hover:bg-red-500 transition-colors" />
          <div className="w-3 h-3 rounded-full bg-border-subtle hover:bg-yellow-500 transition-colors" />
          <div className="w-3 h-3 rounded-full bg-border-subtle hover:bg-green-500 transition-colors" />
        </div>
        <div className="text-xs font-mono text-text-secondary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
          Live Session
        </div>
      </div>

      <div className="space-y-4 font-body text-sm relative flex-1 overflow-hidden flex flex-col justify-end pb-2">
        <AnimatePresence mode="sync">
          {/* Question */}
          <motion.div key={`q-${exchangeIndex}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} className="flex justify-start shrink-0">
            <div className="bg-bg-elevated border border-border-subtle text-text-primary px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] shadow-sm">
              <span className="font-semibold text-accent-glow text-xs block mb-1">AI Interviewer</span>
              {current.q}
            </div>
          </motion.div>

          {/* Typing indicator */}
          {step === 1 && (
            <motion.div key={`t-${exchangeIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} className="flex justify-end mt-4 shrink-0">
              <TypingIndicator />
            </motion.div>
          )}

          {/* Answer */}
          {step >= 2 && (
            <motion.div key={`a-${exchangeIndex}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} className="flex justify-end mt-4 shrink-0">
              <div className="bg-accent-primary text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-md">
                {current.a}
              </div>
            </motion.div>
          )}

          {/* Feedback */}
          {step >= 3 && (
            <motion.div key={`f-${exchangeIndex}`} initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} className="flex justify-start mt-4 shrink-0">
               <div className="bg-success/10 border border-success/20 text-success px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium">
                 <FiCheckCircle size={16} />
                 <span>{current.f}</span>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Main Landing Page Component ───
const Landing = () => {
  const [scrolled, setScrolled] = useState(false);
  const [preloaderComplete, setPreloaderComplete] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  
  const howItWorksRef = useRef(null);

  // ─── Animation Config Helpers ───
  const getMechanicalContainer = () => ({
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: shouldReduceMotion ? 0 : 0.08 } }
  });
  const getMechanicalItem = () => ({
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 24 },
    visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0.15 : 0.5, ease: [0.16, 1, 0.3, 1] } }
  });
  
  const getWarmContainer = () => ({
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: shouldReduceMotion ? 0 : 0.06 } }
  });
  const getWarmItem = () => ({
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 32 },
    visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0.15 : 0.7, type: shouldReduceMotion ? 'tween' : 'spring', bounce: shouldReduceMotion ? 0 : 0.25 } }
  });

  const getDecisiveContainer = () => ({
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: shouldReduceMotion ? 0 : 0.08 } }
  });
  const getDecisiveItem = () => ({
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 28 },
    visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0.15 : 0.5, ease: 'easeOut' } }
  });
  const getDecisiveButton = () => ({
    hidden: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: shouldReduceMotion ? 0.15 : 0.4, ease: 'easeOut' } }
  });
  // ─── /Animation Config Helpers ───

  // Handle scroll for navbar shadow
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // GSAP Scroll Animations for How It Works
  useEffect(() => {
    if (!preloaderComplete) return;

    let ctx = gsap.context(() => {
      // Light Trail Animation
      const wrapper = document.querySelector('.space-y-32');
      const svg = document.querySelector('#trail-svg');
      const trackPath = document.querySelector('#track-path');
      const brightPath = document.querySelector('#bright-path');
      const comet = document.querySelector('#comet-dot');
      const nodes = document.querySelectorAll('.trail-node');
      
      if (!wrapper || !svg) return;

      let totalLength = 0;
      const proxy = { progress: 0 };

      const resize = () => {
        const w = wrapper.clientWidth;
        const h = wrapper.clientHeight;
        if (w === 0 || h === 0) return;

        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        
        const isMobile = window.innerWidth < 768;
        let d = '';
        if (isMobile) {
           const x = 32;
           d = `M ${x} 0 L ${x} ${h}`;
           const pts = [{x, y: h * 0.16}, {x, y: h * 0.5}, {x, y: h * 0.83}];
           nodes.forEach((n, i) => {
             n.setAttribute('transform', `translate(${pts[i].x}, ${pts[i].y})`);
           });
        } else {
           const startX = w * 0.5;
           // Weave toward the images (Card 1: Right, Card 2: Left, Card 3: Right)
           const c1x = w * 0.75; const c1y = h * 0.16;
           const c2x = w * 0.25; const c2y = h * 0.50;
           const c3x = w * 0.75; const c3y = h * 0.83;
           
           d = `M ${startX} 0 C ${startX} ${c1y * 0.5}, ${c1x} ${c1y * 0.5}, ${c1x} ${c1y} C ${c1x} ${c1y + (c2y - c1y) * 0.5}, ${c2x} ${c2y - (c2y - c1y) * 0.5}, ${c2x} ${c2y} C ${c2x} ${c2y + (c3y - c2y) * 0.5}, ${c3x} ${c3y - (c3y - c2y) * 0.5}, ${c3x} ${c3y} C ${c3x} ${h - (h - c3y) * 0.5}, ${startX} ${h - (h - c3y) * 0.5}, ${startX} ${h}`;
           
           const pts = [{x: c1x, y: c1y}, {x: c2x, y: c2y}, {x: c3x, y: c3y}];
           nodes.forEach((n, i) => {
             n.setAttribute('transform', `translate(${pts[i].x}, ${pts[i].y})`);
           });
        }
        
        trackPath.setAttribute('d', d);
        brightPath.setAttribute('d', d);
        totalLength = brightPath.getTotalLength();
        
        brightPath.style.strokeDasharray = totalLength;
        // Keep current progress visually synced if resizing mid-scroll
        if (proxy && totalLength > 0) {
           brightPath.style.strokeDashoffset = totalLength * (1 - proxy.progress);
        } else {
           brightPath.style.strokeDashoffset = totalLength;
        }

        ScrollTrigger.refresh();
      };
      
      const resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(wrapper);
      
      gsap.to(proxy, {
        progress: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: howItWorksRef.current,
          start: 'top 50%',
          end: 'bottom 50%',
          scrub: 1,
          onUpdate: () => {
            const p = proxy.progress;
            brightPath.style.strokeDashoffset = totalLength * (1 - p);
            
            if (p > 0.01 && p < 0.99 && totalLength > 0) {
              comet.style.opacity = 1;
              try {
                const pt = brightPath.getPointAtLength(p * totalLength);
                comet.setAttribute('cx', pt.x);
                comet.setAttribute('cy', pt.y);
              } catch (e) {
                // Ignore if path is uninitialized
              }
            } else {
              comet.style.opacity = 0;
            }
            
            nodes.forEach((n, i) => {
               const thresholds = [0.18, 0.50, 0.82]; // Match arc lengths
               const thresh = thresholds[i];
               const inner = n.querySelector('.inner-glow');
               if (p >= thresh) {
                  gsap.to(inner, { scale: 1, opacity: 1, duration: 0.4, overwrite: 'auto' });
               } else {
                  gsap.to(inner, { scale: 0, opacity: 0, duration: 0.4, overwrite: 'auto' });
               }
            });
          }
        }
      });
      
      return () => resizeObserver.disconnect();
    }, howItWorksRef);

    return () => ctx.revert();
  }, [preloaderComplete]);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {!preloaderComplete && <Preloader onComplete={() => setPreloaderComplete(true)} />}
      
      <div className="min-h-screen bg-bg-canvas text-text-primary font-body overflow-x-clip">
        <SEOHead 
          title="Evalix — AI Mock Interview & Technical Prep Platform"
          description="Ace your software engineering interviews with Evalix. Practice realistic AI voice mock interviews, resume-tailored questions, and timed coding assessments."
          keywords={[
            'AI mock interview', 'technical interview prep', 'software engineer mock interview',
            'voice interview practice', 'resume ATS analyzer', 'coding assessment simulator',
            'React interview questions', 'system design mock interview'
          ]}
          canonicalUrl="https://interview-ai-ten-psi.vercel.app/"
        />
      
      {/* ─── 1. Navigation Bar ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 flex justify-center pt-6 px-4`}>
        <div className={`flex justify-between items-center transition-all duration-300 w-full ${scrolled ? 'glass px-6 py-3 rounded-full max-w-4xl border-border-subtle shadow-md' : 'px-6 py-3 max-w-7xl'}`}>
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group shrink-0">
            <span className="text-xl font-bold tracking-tight text-text-primary">
              Evalix
            </span>
          </Link>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center space-x-8">
            <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">Features</button>
            <button onClick={() => scrollToSection('how-it-works')} className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">How it works</button>
            <button onClick={() => scrollToSection('comparison')} className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">Comparison</button>
            <button onClick={() => scrollToSection('faq')} className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">FAQ</button>
          </nav>

          {/* Auth & Theme Buttons */}
          <div className="flex items-center gap-4 shrink-0">
            <SignedIn>
              <Link to="/dashboard" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors hidden sm:block">
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <Link to="/login" className="hidden sm:block text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                Log In
              </Link>
              <Link to="/register" className="bg-text-primary text-bg-canvas px-5 py-2 rounded-full font-semibold text-sm hover:opacity-90 transition-all shadow-md hover-lift">
                Start Free Interview
              </Link>
            </SignedOut>
            
            <div className="w-px h-5 bg-border-subtle hidden sm:block" />
            
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-bg-elevated transition-colors text-text-secondary hover:text-text-primary flex items-center justify-center -ml-1 sm:ml-0"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content">
      {/* ─── 2. Hero Section ─── */}
      <section className="relative pt-40 pb-20 lg:pt-48 lg:pb-32 overflow-hidden isolate">
        
        {/* Decorative Glows */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent-primary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute top-[10%] right-[-10%] w-96 h-96 bg-accent-glow/10 rounded-full blur-[100px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center">
          
          {/* Hero Content (Left) */}
          <div className="z-10 flex flex-col text-center lg:text-left items-center lg:items-start">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="w-full">
              
              <div className="inline-flex items-center space-x-2 bg-bg-elevated border border-border-subtle rounded-full px-4 py-1.5 mb-8 shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-accent-glow animate-pulse"></span>
                <span className="text-xs font-mono text-text-secondary uppercase tracking-widest">AI Technical Mock Interview Platform</span>
              </div>
              
              <h1 className="text-[40px] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-bold font-display tracking-[-0.03em] text-text-primary mb-6">
                Ace Technical Interviews with <br className="hidden sm:block" />
                <span className="text-gradient">Real-Time Voice AI.</span>
              </h1>
              
              <p className="text-lg text-text-secondary leading-[1.6] max-w-xl mx-auto lg:mx-0 mb-10">
                Experience hyper-realistic AI mock interviews tailored to your resume. Practice live voice technical rounds, solve timed coding assessments, and get instant feedback with score breakdowns.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-center lg:justify-start">
                <MagneticButton strength={30}>
                  <Link to="/register" className="w-full sm:w-auto bg-accent-primary text-white px-8 py-3.5 rounded-full font-semibold text-base hover:bg-accent-glow shadow-[0_0_20px_rgba(108,92,231,0.4)] hover:shadow-[0_0_30px_rgba(108,92,231,0.6)] hover-scale text-center transition-all flex items-center justify-center">
                    Start Free Interview
                  </Link>
                </MagneticButton>
                <MagneticButton strength={20}>
                  <button onClick={() => scrollToSection('how-it-works')} className="w-full sm:w-auto bg-transparent border border-border-subtle text-text-primary px-8 py-3.5 rounded-full font-medium text-base hover:bg-bg-elevated text-center transition-all flex items-center justify-center gap-2">
                    <FiVideo size={18} /> Watch demo
                  </button>
                </MagneticButton>
              </div>

            </motion.div>
          </div>

          {/* Right Visual - Mock Interview Demo */}
          <div className="z-10 w-full">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}>
               <HeroMockInterview />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── 3. Social Proof / Tech Stack ─── */}
      <section className="py-10 bg-bg-canvas border-y border-border-subtle overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 mb-8 text-center">
          <p className="text-xs font-mono text-text-secondary uppercase tracking-widest">Powered by modern web technologies</p>
        </div>
        <div className="relative w-full flex overflow-x-clip">
          <div className="flex w-max animate-scroll-logos opacity-50 items-center">
            {['React', 'Gemini AI', 'MongoDB', 'Express', 'Clerk Auth', 'Socket.io', 'Tailwind CSS', 'Vite'].map((tech, i) => (
              <span key={i} className="text-xl font-bold text-text-secondary mx-12 font-display shrink-0 flex items-center gap-2">
                <FiCheckCircle className="text-accent-primary" /> {tech}
              </span>
            ))}
            {['React', 'Gemini AI', 'MongoDB', 'Express', 'Clerk Auth', 'Socket.io', 'Tailwind CSS', 'Vite'].map((tech, i) => (
              <span key={`dup-${i}`} className="text-xl font-bold text-text-secondary mx-12 font-display shrink-0 flex items-center gap-2">
                <FiCheckCircle className="text-accent-primary" /> {tech}
              </span>
            ))}
          </div>
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-bg-canvas to-transparent pointer-events-none"></div>
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-bg-canvas to-transparent pointer-events-none"></div>
        </div>
      </section>

      {/* ─── 4. The Problem ─── */}
      <section id="features" className="py-24 bg-bg-surface relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-text-primary mb-4">
              Traditional prep is broken.
            </h2>
            <p className="text-text-secondary">
              Reading static lists of questions doesn't prepare you for the pressure of a real interview.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
              <TiltCard className="bg-bg-elevated border border-border-subtle p-10 rounded-[32px] flex flex-col items-center text-center gap-4 h-full shadow-md">
                <div className="w-16 h-16 bg-bg-surface border border-border-subtle rounded-2xl flex items-center justify-center text-accent-glow mb-4">
                  <FiFileText size={28} />
                </div>
                <p className="text-text-primary font-medium text-xl">Generic advice ignores your resume</p>
                <p className="text-text-secondary mt-2">Static lists won't help when they ask you to dive deep into a specific project on your CV.</p>
              </TiltCard>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
              <TiltCard className="bg-bg-elevated border border-border-subtle p-10 rounded-[32px] flex flex-col items-center text-center gap-4 h-full shadow-md">
                <div className="w-16 h-16 bg-bg-surface border border-border-subtle rounded-2xl flex items-center justify-center text-accent-glow mb-4">
                  <FiMessageSquare size={28} />
                </div>
                <p className="text-text-primary font-medium text-xl">No real-time feedback on delivery</p>
                <p className="text-text-secondary mt-2">Practicing alone in the mirror doesn't tell you if you sound confident or if you're rambling.</p>
              </TiltCard>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
              <TiltCard className="bg-bg-elevated border border-border-subtle p-10 rounded-[32px] flex flex-col items-center text-center gap-4 h-full shadow-md">
                <div className="w-16 h-16 bg-bg-surface border border-border-subtle rounded-2xl flex items-center justify-center text-accent-glow mb-4">
                  <FiTrendingUp size={28} />
                </div>
                <p className="text-text-primary font-medium text-xl">Hard to track actual improvement</p>
                <p className="text-text-secondary mt-2">Without measurable metrics, it's impossible to know if you're actually getting better at interviewing.</p>
              </TiltCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── 5. How It Works (Alternating) ─── */}
      <section id="how-it-works" className="py-24 bg-bg-canvas relative border-y border-border-subtle overflow-hidden" ref={howItWorksRef}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold font-display text-text-primary mb-4">
              How Evalix works
            </h2>
          </div>

          <div className="space-y-32 relative">
            
            {/* GSAP Native Light Trail SVG */}
            <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <svg id="trail-svg" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="track-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--border-subtle)" stopOpacity="0.1" />
                    <stop offset="20%" stopColor="var(--border-subtle)" stopOpacity="0.4" />
                    <stop offset="80%" stopColor="var(--border-subtle)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--border-subtle)" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                
                {/* Track */}
                <path id="track-path" stroke="url(#track-grad)" strokeWidth="3" d="M0 0" />
                
                {/* Bright Line with Drop Shadow for extra glow */}
                <path id="bright-path" stroke="var(--accent-glow)" strokeWidth="4" filter="drop-shadow(0 0 16px var(--accent-primary))" style={{ strokeLinecap: 'round' }} d="M0 0" />
                
                {/* Comet Head */}
                <circle id="comet-dot" r="6" fill="white" style={{ opacity: 0, filter: 'drop-shadow(0 0 12px var(--accent-glow))' }} />

                {/* Nodes */}
                {[0, 1, 2].map(i => (
                  <g key={i} className="trail-node">
                    <circle r="12" stroke="var(--border-subtle)" strokeWidth="1" fill="var(--bg-surface)" />
                    <circle className="inner-glow" r="5" fill="var(--accent-primary)" style={{ transformOrigin: 'center', scale: 0, opacity: 0, filter: 'drop-shadow(0 0 8px var(--accent-glow))' }} />
                  </g>
                ))}
              </svg>
            </div>

            {/* Row 1 */}
            <div className="gsap-row relative z-10 flex flex-col md:flex-row items-center gap-12 lg:gap-24">
              <div className="gsap-text flex-1 space-y-6 md:sticky md:top-32">
                <div className="w-12 h-12 bg-accent-primary/10 text-accent-glow rounded-xl flex items-center justify-center font-mono font-bold text-xl">1</div>
                <h3 className="text-2xl md:text-3xl font-bold font-display text-text-primary">Resume-Aware Question Generation</h3>
                <p className="text-text-secondary text-lg leading-relaxed">
                  Upload your resume and the target job description. Our AI analyzes the overlap, identifies gaps, and generates highly specific questions tailored just for you.
                </p>
              </div>
              <div className="gsap-img flex-1 w-full bg-bg-surface border border-border-subtle rounded-[32px] p-8 min-h-[300px] flex items-center justify-center shadow-md">
                 <div className="w-full max-w-sm space-y-4">
                   <div className="h-4 w-3/4 bg-border-subtle rounded-full animate-pulse"></div>
                   <div className="h-4 w-full bg-border-subtle rounded-full animate-pulse delay-75"></div>
                   <div className="h-4 w-5/6 bg-border-subtle rounded-full animate-pulse delay-150"></div>
                   <div className="mt-8 p-4 border border-accent-primary/30 bg-accent-primary/5 rounded-xl border-dashed">
                     <span className="text-accent-glow text-sm font-medium flex items-center gap-2"><FiCheckCircle /> Match found: React + Node.js</span>
                   </div>
                 </div>
              </div>
            </div>

            {/* Row 2 */}
            <div className="gsap-row relative z-10 flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-24">
              <div className="gsap-text flex-1 space-y-6 md:sticky md:top-32">
                <div className="w-12 h-12 bg-accent-primary/10 text-accent-glow rounded-xl flex items-center justify-center font-mono font-bold text-xl">2</div>
                <h3 className="text-2xl md:text-3xl font-bold font-display text-text-primary">Real-Time Mock Interview</h3>
                <p className="text-text-secondary text-lg leading-relaxed">
                  Engage in a back-and-forth conversation with our AI interviewer. It listens, adapts to your answers, and drills deeper just like a real hiring manager would.
                </p>
              </div>
              <div className="gsap-img flex-1 w-full bg-bg-surface border border-border-subtle rounded-[32px] p-8 min-h-[300px] flex items-center justify-center shadow-md relative overflow-hidden">
                 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent-primary/10 via-bg-surface to-bg-surface"></div>
                 <div className="relative flex flex-col gap-4 w-full max-w-sm">
                    <div className="bg-bg-elevated p-4 rounded-2xl rounded-tl-none border border-border-subtle w-4/5">Tell me about a time you failed.</div>
                    <div className="bg-accent-primary text-white p-4 rounded-2xl rounded-tr-none self-end w-4/5 shadow-glow">I once miscalculated a database migration...</div>
                 </div>
              </div>
            </div>

            {/* Row 3 */}
            <div className="gsap-row relative z-10 flex flex-col md:flex-row items-center gap-12 lg:gap-24">
              <div className="gsap-text flex-1 space-y-6 md:sticky md:top-32">
                <div className="w-12 h-12 bg-accent-primary/10 text-accent-glow rounded-xl flex items-center justify-center font-mono font-bold text-xl">3</div>
                <h3 className="text-2xl md:text-3xl font-bold font-display text-text-primary">Instant Structured Feedback</h3>
                <p className="text-text-secondary text-lg leading-relaxed">
                  After every session, receive a detailed breakdown of your performance, including metrics on clarity, conciseness, and technical accuracy, along with suggestions for improvement.
                </p>
              </div>
              <div className="gsap-img flex-1 w-full bg-bg-surface border border-border-subtle rounded-[32px] p-8 min-h-[300px] flex items-center justify-center shadow-md">
                 <div className="w-full max-w-sm space-y-4">
                    <div className="flex justify-between items-center mb-6">
                      <span className="font-semibold text-text-primary">Overall Score</span>
                      <span className="text-3xl font-bold text-success">85%</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-text-secondary">Clarity</span><span className="text-text-primary">90%</span></div>
                      <div className="h-2 w-full bg-bg-elevated rounded-full overflow-hidden"><div className="h-full bg-success w-[90%]"></div></div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-text-secondary">Technical Depth</span><span className="text-text-primary">75%</span></div>
                      <div className="h-2 w-full bg-bg-elevated rounded-full overflow-hidden"><div className="h-full bg-warning w-[75%]"></div></div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Tech Architecture ─── */}
      <section className="py-24 bg-bg-surface border-y border-border-subtle overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            variants={getMechanicalContainer()}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <motion.h2 variants={getMechanicalItem()} className="text-3xl md:text-5xl font-bold font-display text-text-primary mb-4">
              Built for Speed and Scale
            </motion.h2>
            <motion.p variants={getMechanicalItem()} className="text-lg text-text-secondary">
              A modern, real-time architecture powering your interview experience.
            </motion.p>
            
            <motion.div variants={getMechanicalItem()} className="flex justify-center gap-12 mt-12 mb-8">
              <div className="flex flex-col items-center">
                <span className="text-4xl font-bold text-accent-glow font-mono"><AnimatedNumber end={30} duration={800} suffix="ms" /></span>
                <span className="text-sm text-text-secondary mt-1 uppercase tracking-wider">Average Latency</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-4xl font-bold text-accent-glow font-mono"><AnimatedNumber end={99} duration={1000} suffix=".9%" /></span>
                <span className="text-sm text-text-secondary mt-1 uppercase tracking-wider">Uptime</span>
              </div>
            </motion.div>
          </motion.div>
          
          <motion.div
            variants={getMechanicalContainer()}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <motion.div variants={getMechanicalItem()}>
              <TechArchitecture />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── 6. Comparison Section ─── */}
      <ComparisonSection />

      {/* ─── 7. FAQ Section ─── */}
      <FAQSection />

      {/* ─── 8. Final CTA Band ─── */}
      <section className="py-24 bg-bg-surface relative overflow-hidden border-y border-border-subtle">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent-primary/20 via-bg-surface to-bg-surface"></div>
        
        <motion.div 
          className="max-w-4xl mx-auto px-6 text-center relative z-10"
          variants={getDecisiveContainer()}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.h2 variants={getDecisiveItem()} className="text-4xl md:text-6xl font-bold font-display text-text-primary mb-6 tracking-tight">
            Ready to ace your next interview?
          </motion.h2>
          <motion.p variants={getDecisiveItem()} className="text-xl text-text-secondary mb-10 max-w-2xl mx-auto">
            Join thousands of professionals who have transformed their interview preparation and landed their dream roles.
          </motion.p>
          
          <motion.div variants={getDecisiveButton()} className="flex justify-center relative inline-block">
            {/* Ambient CTA Glow */}
            {!shouldReduceMotion && (
               <motion.div 
                 className="absolute inset-0 bg-accent-glow rounded-full blur-xl z-0" 
                 initial={{ opacity: 0 }}
                 whileInView={{ opacity: 0.15 }}
                 viewport={{ once: true, amount: 0.2 }}
                 transition={{ delay: 0.2, duration: 0.3 }}
               />
            )}
            <Link to="/register" className="relative z-10 bg-text-primary text-bg-canvas px-10 py-4 rounded-full font-bold text-lg hover:opacity-90 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover-lift transition-all inline-block">
              Start Free Interview
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Mobile Bottom CTA Bar ─── */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 p-4 bg-bg-surface/90 backdrop-blur-lg border-t border-border-subtle z-50 transition-transform duration-300 ${scrolled ? 'translate-y-0' : 'translate-y-full'}`}>
        <Link to="/register" className="block w-full bg-accent-primary text-white text-center py-3.5 rounded-full font-semibold shadow-glow">
          Start Free Interview
        </Link>
      </div>
      </main>

      {/* ─── 9. Footer ─── */}
      <motion.footer 
        className="bg-bg-surface pt-14 md:pt-24 border-t border-border-subtle"
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: shouldReduceMotion ? 0.15 : 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            
            {/* Brand Column */}
            <div className="flex flex-col">
              <Link to="/" className="flex items-center space-x-2 mb-4 p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors w-fit">
                <span className="text-xl font-bold tracking-tight text-text-primary font-display">
                  Evalix
                </span>
              </Link>
              <p className="text-sm text-text-secondary mb-6 max-w-sm leading-relaxed">
                The ultimate AI-powered platform for interview preparation. Build confidence and land your dream role.
              </p>
              <div className="flex space-x-4">
                <a href="https://github.com/shubham574/InterviewAI" target="_blank" rel="noopener noreferrer" className="p-3 -ml-3 text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 rounded-lg" aria-label="GitHub Repository">
                  <FiGithub size={20} />
                </a>
                <a href="https://www.linkedin.com/in/shubham-maurya-937511309/" target="_blank" rel="noopener noreferrer" className="p-3 text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 rounded-lg" aria-label="LinkedIn Profile">
                  <FiLinkedin size={20} />
                </a>
              </div>
            </div>

            {/* Product Column */}
            <div className="flex flex-col">
              <h4 className="text-text-secondary font-mono text-sm tracking-wider uppercase mb-6">Product</h4>
              <ul className="space-y-4">
                <li><a href="#features" className="text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 inline-block py-1">Features</a></li>
                <li><a href="#how-it-works" className="text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 inline-block py-1">How it works</a></li>
                <li><a href="#comparison" className="text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 inline-block py-1">Comparison</a></li>
                <li><a href="#faq" className="text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 inline-block py-1">FAQ</a></li>
                <li><Link to="/register" className="text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 inline-block py-1">Start Free Interview</Link></li>
              </ul>
            </div>

            {/* Interview Guides & Roles (SEO internal links) */}
            <div className="flex flex-col">
              <h4 className="text-text-secondary font-mono text-sm tracking-wider uppercase mb-6">Prep Guides</h4>
              <ul className="space-y-4">
                <li>
                  <Link to="/mock-interview-for-react-developers" className="text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 inline-block py-1">
                    React Interview Prep
                  </Link>
                </li>
                <li>
                  <Link to="/resume-based-interview-questions" className="text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 inline-block py-1">
                    Resume Questions
                  </Link>
                </li>
                <li>
                  <Link to="/system-design-mock-interview" className="text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 inline-block py-1">
                    System Design Mock
                  </Link>
                </li>
                <li>
                  <Link to="/mock-interview-for-freshers" className="text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 inline-block py-1">
                    Freshers Placement Prep
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources & Tech Stack Column */}
            <div className="flex flex-col">
              <h4 className="text-text-secondary font-mono text-sm tracking-wider uppercase mb-6">Developer</h4>
              <ul className="space-y-4">
                <li>
                  <a href="https://github.com/shubham574/InterviewAI" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-text-primary hover:-translate-y-[2px] transition-all duration-150 inline-block py-1">
                    GitHub Repository
                  </a>
                </li>
                <li>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2 py-1 bg-bg-canvas border border-border-subtle rounded text-xs text-text-secondary font-mono">React 19</span>
                    <span className="px-2 py-1 bg-bg-canvas border border-border-subtle rounded text-xs text-text-secondary font-mono">Express 5</span>
                    <span className="px-2 py-1 bg-bg-canvas border border-border-subtle rounded text-xs text-text-secondary font-mono">MongoDB</span>
                    <span className="px-2 py-1 bg-bg-canvas border border-border-subtle rounded text-xs text-text-secondary font-mono">Gemini AI</span>
                  </div>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="border-t border-border-subtle py-6 md:py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <p className="text-sm text-text-secondary">© {new Date().getFullYear()} Evalix. All rights reserved.</p>
            <p className="text-[12px] text-text-secondary font-mono">
              Built with React, Express, MongoDB & Gemini
            </p>
          </div>
        </div>
      </motion.footer>
    </div>
    </>
  );
};

// ─── Reusable Micro-components ───

const ComparisonSection = () => {
  const comparisonRows = [
    { feature: "Instant 24/7 Availability", evalix: true, leetcode: true, humanCoaching: false },
    { feature: "Live Conversational Voice Simulation", evalix: true, leetcode: false, humanCoaching: true },
    { feature: "Questions Tailored to Your Specific Resume", evalix: true, leetcode: false, humanCoaching: "Partial" },
    { feature: "Adaptive Difficulty (Easy, Med, Hard)", evalix: true, leetcode: true, humanCoaching: "Varies" },
    { feature: "System Design & Behavioral Evaluation", evalix: true, leetcode: false, humanCoaching: true },
    { feature: "Instant Quantitative Rubric Scoring", evalix: true, leetcode: "Pass/Fail Only", humanCoaching: false },
    { feature: "Cost per Session", evalix: "Free Tier Available", leetcode: "$35/mo Premium", humanCoaching: "$150-$250 / hr" },
  ];

  return (
    <section id="comparison" className="py-24 bg-bg-canvas relative border-b border-border-subtle" aria-labelledby="comparison-heading">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 bg-bg-elevated border border-border-subtle rounded-full px-4 py-1.5 mb-4 shadow-sm">
            <span className="text-xs font-mono text-accent-glow uppercase tracking-widest">Platform Comparison</span>
          </div>
          <h2 id="comparison-heading" className="text-3xl md:text-5xl font-bold font-display text-text-primary mb-4">
            Why Engineers Choose Evalix
          </h2>
          <p className="text-text-secondary text-lg">
            Compare Evalix to traditional static coding platforms and expensive human coaching.
          </p>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-3xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-elevated/50">
                  <th className="py-5 px-6 font-semibold text-text-primary text-base">Preparation Feature</th>
                  <th className="py-5 px-6 font-bold text-accent-glow text-base bg-accent-primary/10">Evalix AI</th>
                  <th className="py-5 px-6 font-semibold text-text-secondary text-base">Static LeetCode</th>
                  <th className="py-5 px-6 font-semibold text-text-secondary text-base">Human Coaching</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-bg-elevated/30 transition-colors">
                    <td className="py-4 px-6 font-medium text-text-primary">{row.feature}</td>
                    <td className="py-4 px-6 font-semibold text-text-primary bg-accent-primary/5">
                      {typeof row.evalix === 'boolean' ? (
                        row.evalix ? <span className="inline-flex items-center text-success gap-1.5"><FiCheckCircle size={16} /> Yes</span> : <span className="text-text-secondary">No</span>
                      ) : (
                        <span className="text-accent-primary font-bold">{row.evalix}</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-text-secondary">
                      {typeof row.leetcode === 'boolean' ? (
                        row.leetcode ? <span className="inline-flex items-center text-success gap-1"><FiCheckCircle size={14} /> Yes</span> : <span className="text-text-secondary opacity-60">✕ No</span>
                      ) : row.leetcode}
                    </td>
                    <td className="py-4 px-6 text-text-secondary">
                      {typeof row.humanCoaching === 'boolean' ? (
                        row.humanCoaching ? <span className="inline-flex items-center text-success gap-1"><FiCheckCircle size={14} /> Yes</span> : <span className="text-text-secondary opacity-60">✕ No</span>
                      ) : row.humanCoaching}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

const faqs = [
  {
    q: "How does an AI mock interview work on Evalix?",
    a: "Evalix simulates a real hiring manager interview using Google Gemini 1.5 Flash. You can converse via real-time voice or interactive chat. The AI asks technical and behavioral questions, evaluates your spoken or written answers, asks follow-up drill-down questions, and provides an immediate score with suggestions for improvement."
  },
  {
    q: "Can Evalix generate interview questions from my resume and job description?",
    a: "Yes. When you upload your PDF resume along with your target job description, Evalix extracts your skill stack and identifies potential gaps. It then generates personalized, role-specific questions tailored specifically to your projects and experience."
  },
  {
    q: "Is Evalix free to use for technical interview practice?",
    a: "Yes, Evalix offers a free tier that allows candidates to sign up and immediately start practicing with full-length mock interviews, resume scans, and timed multiple-choice assessments."
  },
  {
    q: "How realistic is the AI voice interview simulation?",
    a: "Evalix pairs multimodal Gemini audio transcription with low-latency Speech-to-Text and Text-to-Speech synthesis (with native browser Web Speech API fallback) to deliver conversational, lifelike voice exchanges with sub-50ms processing latency."
  },
  {
    q: "What tech stacks and developer roles are supported?",
    a: "Evalix supports Frontend (React, Vue, TypeScript, Next.js), Backend (Node.js, Express, Python, Java, Go), Full Stack, DevOps, System Design, and Data Structures & Algorithms (DSA)."
  },
  {
    q: "How does AI scoring compare to a human mock interviewer?",
    a: "Evalix evaluates answers across four objective vectors: Technical Accuracy, Depth & Edge Cases, Communication Clarity, and Structure (e.g. STAR method). Candidates receive itemized rubrics and actionable model answers without the scheduling friction or high hourly cost of human coaching platforms."
  }
];

const FAQSection = () => {
  const [openIdx, setOpenIdx] = useState(null);

  const toggle = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-24 bg-bg-surface border-b border-border-subtle">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-bg-elevated border border-border-subtle rounded-full px-4 py-1.5 mb-4 shadow-sm">
            <FiHelpCircle className="text-accent-primary" size={14} />
            <span className="text-xs font-mono text-accent-glow uppercase tracking-widest">Common Inquiries</span>
          </div>
          <h2 id="faq-heading" className="text-3xl md:text-5xl font-bold font-display text-text-primary mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-text-secondary text-lg">
            Everything you need to know about AI mock interviews, Shristi voice sessions, and resume ATS analysis.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div 
                key={idx} 
                className="border border-border-subtle rounded-2xl bg-bg-elevated overflow-hidden transition-all duration-200 hover:border-accent-primary/40"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  className="w-full text-left p-6 font-display font-semibold text-lg text-text-primary flex justify-between items-center gap-4 hover:text-accent-glow transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <FiChevronDown 
                    className={`shrink-0 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180 text-accent-primary' : ''}`} 
                    size={20} 
                  />
                </button>
                {isOpen && (
                  <div 
                    id={`faq-answer-${idx}`} 
                    role="region" 
                    className="px-6 pb-6 text-text-secondary leading-relaxed border-t border-border-subtle/40 pt-4"
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const TechArchitecture = () => {
  const [activeNode, setActiveNode] = useState(null);
  
  // Custom layout for mobile vs desktop could be complex, we'll use a responsive flex approach
  // instead of fixed absolute positioning for better responsiveness.
  const nodes = [
    { id: 'client', label: 'React Client', desc: 'Vite + Tailwind' },
    { id: 'api', label: 'Express 5 API', desc: 'Node.js Backend' },
    { id: 'ai', label: 'Gemini AI', desc: 'LLM Engine' },
    { id: 'db', label: 'MongoDB', desc: 'Data Store' },
    { id: 'auth', label: 'Clerk', desc: 'Authentication' },
  ];

  return (
    <div className="relative w-full max-w-4xl mx-auto bg-bg-canvas border border-border-subtle rounded-3xl p-8 lg:p-16 shadow-lg overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 md:gap-0">
      
      {/* Client Node */}
      <div 
        onMouseEnter={() => setActiveNode('client')} onMouseLeave={() => setActiveNode(null)}
        className={`relative z-10 w-full md:w-auto text-center px-6 py-4 rounded-2xl border transition-all duration-300 ${activeNode === 'client' || activeNode === null ? 'bg-bg-elevated border-accent-primary shadow-glow scale-105' : 'bg-bg-surface border-border-subtle opacity-50 scale-100'}`}
      >
        <div className="font-bold text-text-primary">{nodes[0].label}</div>
        <div className="text-xs text-text-secondary mt-1 font-mono">{nodes[0].desc}</div>
      </div>

      {/* Connection 1 */}
      <div className="hidden md:block flex-1 h-px bg-border-subtle relative">
         <div className={`absolute inset-0 bg-accent-primary transition-all duration-500 origin-left ${activeNode === 'client' || activeNode === 'api' ? 'scale-x-100' : 'scale-x-0'}`}></div>
      </div>

      {/* API Node */}
      <div 
        onMouseEnter={() => setActiveNode('api')} onMouseLeave={() => setActiveNode(null)}
        className={`relative z-10 w-full md:w-auto text-center px-6 py-4 rounded-2xl border transition-all duration-300 ${activeNode === 'api' || activeNode === null ? 'bg-bg-elevated border-accent-primary shadow-glow scale-105' : 'bg-bg-surface border-border-subtle opacity-50 scale-100'}`}
      >
        <div className="font-bold text-text-primary">{nodes[1].label}</div>
        <div className="text-xs text-text-secondary mt-1 font-mono">{nodes[1].desc}</div>
      </div>

      {/* Connections 2 (Fork) */}
      <div className="hidden md:block w-16 h-48 border-y border-r border-border-subtle rounded-r-3xl relative ml-[-1px]">
         {/* Top fork to AI */}
         <div className={`absolute top-[-1px] left-0 w-full h-px bg-accent-primary transition-all duration-500 origin-left ${activeNode === 'api' || activeNode === 'ai' ? 'scale-x-100' : 'scale-x-0'}`}></div>
         {/* Bottom fork to Auth/DB */}
         <div className={`absolute bottom-[-1px] left-0 w-full h-px bg-accent-primary transition-all duration-500 origin-left ${activeNode === 'api' || activeNode === 'db' || activeNode === 'auth' ? 'scale-x-100' : 'scale-x-0'}`}></div>
      </div>

      {/* Services Stack */}
      <div className="flex flex-col gap-4 w-full md:w-auto ml-0 md:ml-4">
        {nodes.slice(2).map(node => (
          <div 
            key={node.id}
            onMouseEnter={() => setActiveNode(node.id)} onMouseLeave={() => setActiveNode(null)}
            className={`relative z-10 text-center px-6 py-4 rounded-2xl border transition-all duration-300 ${activeNode === node.id || activeNode === null ? 'bg-bg-elevated border-accent-primary shadow-glow scale-105' : 'bg-bg-surface border-border-subtle opacity-50 scale-100'}`}
          >
            <div className="font-bold text-text-primary">{node.label}</div>
            <div className="text-xs text-text-secondary mt-1 font-mono">{node.desc}</div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default Landing;
