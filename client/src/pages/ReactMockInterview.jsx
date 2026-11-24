import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FiCode, FiCpu, FiArrowRight, FiVideo, FiLayers, FiZap } from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';
import { Button } from '@/components/shadcn/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/shadcn/accordion';
import { Aura, Eyebrow, Reveal } from '@/components/studio';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

const sampleQuestions = [
  {
    topic: "React Performance Optimization",
    q: "How would you diagnose and fix unnecessary re-renders in a complex React dashboard?",
    a: "Start by profiling with React DevTools to identify offending components. Use React.memo for pure components with stable props, useMemo for computationally expensive derivations, and useCallback to preserve reference equality for function props. For deep state hierarchies, split state contexts or use atomic state managers like Zustand."
  },
  {
    topic: "Hooks & Component Lifecycle",
    q: "What is the difference between useEffect, useLayoutEffect, and useInsertionEffect?",
    a: "useEffect runs asynchronously after paint, ideal for data fetching and subscriptions. useLayoutEffect runs synchronously after DOM mutations but before browser paint, preventing visual layout flickers. useInsertionEffect runs before DOM mutations specifically for CSS-in-JS libraries to inject style tags."
  },
  {
    topic: "React 19 & Concurrent Features",
    q: "How does the React 19 Action pattern and useActionState simplify asynchronous form handling?",
    a: "React 19 Actions automatically manage pending states, optimistic updates, and error handling for async operations. useActionState tracks the current action state, loading status, and payload without manual useState and try/catch boilerplate."
  },
  {
    topic: "State Management Architecture",
    q: "When would you choose React Context vs. an external state manager like Zustand or Redux Toolkit?",
    a: "React Context is built for low-frequency global updates (theme, user auth, localization). For high-frequency state updates or fine-grained component re-renders, Context causes entire provider subtrees to re-render. Zustand provides selector-based subscriptions that isolate re-renders precisely."
  }
];

const faqs = [
  {
    q: "How does an AI mock interview for React developers work?",
    a: "You select your target seniority level (Junior, Mid, Senior, Lead). Shristi, your AI interviewer, asks challenging React questions, evaluates your answers in real-time using speech or text, drills deeper into your architectural choices, and provides instant rubric scores."
  },
  {
    q: "What React topics are covered in the mock interviews?",
    a: "Our question bank covers React 19 fundamentals, Hooks architecture, Virtual DOM diffing, State Management (Zustand, Redux, Context), Performance Optimization, TypeScript integration, Next.js / Server Components, and real-world frontend system design."
  },
  {
    q: "Can I practice speaking my answers aloud?",
    a: "Yes! Evalix supports real-time voice interviews. You speak naturally into your microphone, Google Gemini transcribes your response, and Shristi responds verbally with feedback and follow-ups."
  },
  {
    q: "Is this React mock interview free?",
    a: "Yes, Evalix provides a free tier allowing you to practice mock interviews, generate assessment questions, and analyze your frontend developer resume immediately."
  }
];

const topics = [
  { title: "Virtual DOM & Reconciliation", desc: "Diffing algorithm, Fiber tree architecture, batching, and key prop semantics.", icon: FiLayers },
  { title: "Hooks & Component Internals", desc: "Custom hooks, closure traps in useEffect, useMemo cache invalidation, and useRef mechanics.", icon: FiCode },
  { title: "State & Architecture", desc: "Zustand, Context API tradeoffs, server vs. client state, and scalable module design.", icon: FiCpu },
  { title: "Performance Profiling", desc: "Eliminating unnecessary renders, windowing large lists, dynamic imports, and Web Vitals.", icon: FiZap }
];

const TINTS = [
  'bg-peach text-[#167A3A]',
  'bg-lilac text-[#5B4BE0]',
  'bg-mint text-[#2F6B12]',
  'bg-sky text-[#1D5FA8]',
];

const BrandDot = () => (
  <span
    aria-hidden
    className="inline-block w-2.5 h-2.5 rounded-full bg-[conic-gradient(from_200deg,#1D9E4B,#8FDDAA,#2496ED,#C7F36B,#1D9E4B)] shadow-[0_0_0_3px_rgba(29,158,75,0.12)]"
  />
);

const ReactMockInterview = () => {
  useSmoothScroll();
  const [activeQuestion, setActiveQuestion] = useState(0);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": "https://interview-ai-ten-psi.vercel.app/mock-interview-for-react-developers#article",
        "headline": "AI Mock Interview for React Developers: Master Senior Frontend Technical Rounds",
        "description": "Comprehensive guide and interactive AI mock interview practice for React developers. Master hooks, performance optimization, and architectural questions.",
        "image": "https://interview-ai-ten-psi.vercel.app/og-image.png",
        "datePublished": "2026-01-15",
        "dateModified": "2026-11-12",
        "author": {
          "@type": "Organization",
          "name": "Evalix",
          "url": "https://interview-ai-ten-psi.vercel.app/"
        },
        "url": "https://interview-ai-ten-psi.vercel.app/mock-interview-for-react-developers",
        "publisher": {
          "@type": "Organization",
          "name": "Evalix",
          "url": "https://interview-ai-ten-psi.vercel.app/",
          "logo": {
            "@type": "ImageObject",
            "url": "https://interview-ai-ten-psi.vercel.app/og-image.png"
          }
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://interview-ai-ten-psi.vercel.app/mock-interview-for-react-developers#faq",
        "mainEntity": faqs.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.a
          }
        }))
      }
    ]
  };

  const active = sampleQuestions[activeQuestion];

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary font-body overflow-x-clip">
      <SEOHead
        title="AI Mock Interview for React Developers — Technical Frontend Prep"
        description="Practice AI mock interviews for React developers covering hooks, React 19, state management, and frontend system design."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/mock-interview-for-react-developers"
        structuredData={structuredData}
      />

      {/* ─── Slim glass top bar ─── */}
      <header className="sticky top-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4">
        <div className="glass shadow-sm max-w-6xl mx-auto h-14 rounded-full pl-5 pr-2 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 font-display text-[17px] font-medium tracking-[-0.03em] text-text-primary">
            <BrandDot />
            <span>Evalix</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link to="/login" className="px-3 py-2 rounded-full text-[13px] sm:text-sm font-display font-normal text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link to="/register">Start Free Practice</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ─── Hero Section ─── */}
        <section className="relative isolate overflow-hidden -mt-20 pt-36 pb-24 sm:pt-44 sm:pb-32 px-5 sm:px-6">
          <Aura />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-bg-canvas" />

          <div className="relative text-center max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="glass shadow-xs inline-flex items-center gap-2.5 rounded-full pl-2 pr-4 py-1.5 mb-8"
            >
              <span className="w-7 h-7 rounded-full bg-bg-surface flex items-center justify-center text-[#1D9E4B] shadow-xs">
                <FiCode size={14} />
              </span>
              <span className="eyebrow">Frontend Engineering Track</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              className="heading-section text-text-primary text-balance mb-7"
            >
              AI Mock Interview for <br className="hidden sm:block" />
              <span className="serif italic text-[#1D9E4B]">React Developers</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
              className="text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10 text-pretty"
            >
              Practice realistic, interactive voice interviews with AI interviewer Shristi. Tackle senior React 19 questions, test component lifecycle intuition, and receive instant hiring-grade scores.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.26 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/register">
                  <FiVideo size={18} /> Start React Mock Interview
                </Link>
              </Button>
              <Button asChild size="lg" variant="glass" className="w-full sm:w-auto">
                <Link to="/#how-it-works">How It Works</Link>
              </Button>
            </motion.div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-5 sm:px-6 pb-24 space-y-24 sm:space-y-32">
          {/* ─── Core Topics Tested Grid ─── */}
          <section aria-labelledby="topics-heading" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            <Reveal className="lg:col-span-5 lg:sticky lg:top-28 self-start space-y-5">
              <Eyebrow index="01">What gets tested</Eyebrow>
              <h2 id="topics-heading" className="heading-page text-text-primary text-balance">
                What Hiring Managers Test in <span className="serif italic text-[#1D9E4B]">React Interviews</span>
              </h2>
              <p className="text-text-secondary leading-relaxed max-w-md">
                Evalix evaluates your knowledge across core React pillars requested by FAANG and top tech companies.
              </p>
            </Reveal>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {topics.map((col, idx) => {
                const Icon = col.icon;
                return (
                  <Reveal key={idx} delay={idx * 0.06}>
                    <motion.div
                      whileHover={{ y: -4 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                      className="h-full bg-bg-surface border border-border-subtle rounded-[24px] p-7 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-8">
                        <span className={`w-11 h-11 rounded-[14px] flex items-center justify-center ${TINTS[idx % TINTS.length]}`}>
                          <Icon size={18} />
                        </span>
                        <span className="font-mono text-xs text-text-muted">/0{idx + 1}</span>
                      </div>
                      <h3 className="heading-card text-text-primary mb-2">{col.title}</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">{col.desc}</p>
                    </motion.div>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* ─── Interactive Sample Questions ─── */}
          <Reveal>
            <section aria-labelledby="questions-heading" className="bg-bg-surface border border-border-subtle rounded-[32px] shadow-sm p-6 sm:p-10 lg:p-12">
              <div className="max-w-2xl mb-10 space-y-4">
                <Eyebrow index="02">Practice Preview</Eyebrow>
                <h2 id="questions-heading" className="heading-page text-text-primary text-balance">
                  Real React Interview Questions &amp; <span className="serif italic text-[#1D9E4B]">Ideal Answers</span>
                </h2>
                <p className="text-text-secondary leading-relaxed">
                  Here are typical high-signal questions Shristi asks during live mock sessions. Click each topic to review model answers.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                <div className="space-y-2.5">
                  {sampleQuestions.map((item, idx) => {
                    const isActive = activeQuestion === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setActiveQuestion(idx)}
                        className={`w-full text-left p-4 sm:p-5 rounded-[18px] border text-sm transition-all duration-300 cursor-pointer ${
                          isActive
                            ? 'bg-peach border-transparent text-text-primary shadow-xs'
                            : 'bg-bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                        }`}
                      >
                        <span className={`font-mono text-[11px] block mb-1.5 ${isActive ? 'text-[#167A3A]' : 'text-text-muted'}`}>0{idx + 1}</span>
                        <span className="font-display font-normal text-[15px] tracking-[-0.02em]">{item.topic}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="lg:col-span-2 relative overflow-hidden bg-bg-canvas border border-border-subtle rounded-[24px] p-6 sm:p-8 flex flex-col justify-between">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeQuestion}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <span className="eyebrow block mb-3">
                        Topic: {active.topic}
                      </span>
                      <h3 className="font-display font-normal text-xl sm:text-2xl tracking-[-0.03em] leading-snug text-text-primary mb-6 text-balance">
                        {active.q}
                      </h3>
                      <div className="p-5 sm:p-6 bg-bg-surface border border-border-subtle rounded-[18px] text-text-secondary text-sm sm:text-[15px] leading-relaxed mb-6 shadow-xs">
                        <span className="font-display font-normal text-[#5B4BE0] block mb-2">Model Engineering Answer:</span>
                        {active.a}
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  <div className="pt-5 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="text-sm text-text-secondary">Ready to test yourself on voice?</span>
                    <Button asChild size="sm">
                      <Link to="/register">
                        Try live with Shristi <FiArrowRight />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </Reveal>

          {/* ─── FAQ Section ─── */}
          <section aria-labelledby="faq-heading" className="max-w-4xl mx-auto space-y-10">
            <Reveal className="text-center space-y-4">
              <Eyebrow index="03">Questions</Eyebrow>
              <h2 id="faq-heading" className="heading-page text-text-primary text-balance">
                React Mock Interview <span className="serif italic text-[#1D9E4B]">FAQs</span>
              </h2>
              <p className="text-text-secondary">
                Common questions on practicing frontend technical interviews with AI.
              </p>
            </Reveal>

            <Reveal>
              <Accordion type="single" collapsible className="bg-bg-surface border border-border-subtle rounded-[28px] shadow-sm px-6 sm:px-8">
                {faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-border-subtle">
                    <AccordionTrigger className="text-text-primary">{faq.q}</AccordionTrigger>
                    <AccordionContent className="text-text-secondary text-[15px] leading-relaxed pb-6 pr-8">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </section>

          {/* ─── Bottom CTA ─── */}
          <Reveal>
            <section className="relative isolate overflow-hidden rounded-[36px] border border-border-subtle bg-bg-surface px-6 py-16 sm:px-10 sm:py-24 text-center grain">
              <Aura intensity={0.95} />
              <div className="relative z-10 max-w-3xl mx-auto space-y-6">
                <h2 className="heading-section text-text-primary text-balance">
                  Ready to Ace Your <span className="serif italic text-[#1D9E4B]">React Developer Interview?</span>
                </h2>
                <p className="text-text-secondary text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                  Get immediate constructive feedback on code structure, algorithmic efficiency, and communication clarity.
                </p>
                <div className="pt-2">
                  <Button asChild size="xl">
                    <Link to="/register">
                      Start Free React Mock Interview <FiArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            </section>
          </Reveal>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-10 text-sm text-text-secondary">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-5">
          <span className="inline-flex items-center gap-2">
            <BrandDot />
            © {new Date().getFullYear()} Evalix. All rights reserved.
          </span>
          <nav aria-label="Interview tracks" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/" className="link-underline hover:text-text-primary">Home</Link>
            <Link to="/resume-based-interview-questions" className="link-underline hover:text-text-primary">Resume Questions</Link>
            <Link to="/system-design-mock-interview" className="link-underline hover:text-text-primary">System Design</Link>
            <Link to="/mock-interview-for-freshers" className="link-underline hover:text-text-primary">Freshers Prep</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default ReactMockInterview;
