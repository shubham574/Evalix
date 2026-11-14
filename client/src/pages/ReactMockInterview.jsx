import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FiCheckCircle, FiCode, FiCpu, FiArrowRight, FiHelpCircle, 
  FiChevronDown, FiVideo, FiLayers, FiZap, FiAward 
} from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';

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

const ReactMockInterview = () => {
  const [openFaq, setOpenFaq] = useState(null);
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

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary font-body overflow-x-clip">
      <SEOHead 
        title="AI Mock Interview for React Developers — Technical Frontend Prep"
        description="Practice AI mock interviews for React developers covering hooks, React 19, state management, and frontend system design."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/mock-interview-for-react-developers"
        structuredData={structuredData}
      />

      {/* Header Bar */}
      <header className="border-b border-border-subtle bg-bg-surface/90 backdrop-blur-md sticky top-0 z-50 py-3.5 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold font-display text-text-primary flex items-baseline gap-1">
            <span>Evalix</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-display font-semibold text-text-secondary hover:text-text-primary transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="bg-[#FF6B35] text-white px-5 py-2 rounded-[12px] font-display font-semibold text-sm border border-[#151515]/15 shadow-[0_2px_0_#151515] hover:bg-[#EB5822] transition-all">
              Start Free Practice
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-6 py-16 space-y-24">
        {/* ─── Hero Section ─── */}
        <section className="text-center max-w-4xl mx-auto pt-8">
          <div className="inline-flex items-center space-x-2 bg-bg-surface border-[1.5px] border-[#151515] shadow-[2px_2px_0px_#151515] rounded-[10px] px-4 py-1.5 mb-6">
            <FiCode className="text-[#FF6B35]" size={14} />
            <span className="text-xs font-mono text-text-primary font-bold uppercase tracking-widest">Frontend Engineering Track</span>
          </div>

          <h1 className="heading-section text-text-primary mb-6">
            AI Mock Interview for <br className="hidden sm:block" />
            <span className="inline-block px-3 py-0.5 rounded-[12px] bg-[#FF6B35] text-white mt-1">React Developers</span>
          </h1>

          <p className="text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10">
            Practice realistic, interactive voice interviews with AI interviewer Shristi. Tackle senior React 19 questions, test component lifecycle intuition, and receive instant hiring-grade scores.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto bg-[#FF6B35] text-white px-8 py-3.5 rounded-[12px] font-display font-bold text-base shadow-[0_3px_0_#151515] hover:bg-[#EB5822] transition-all flex items-center justify-center gap-2">
              <FiVideo size={18} /> Start React Mock Interview
            </Link>
            <Link to="/#how-it-works" className="w-full sm:w-auto bg-bg-surface border border-border-subtle text-text-primary px-8 py-3.5 rounded-[12px] font-display font-semibold text-base hover:border-[#151515] transition-colors">
              How It Works
            </Link>
          </div>
        </section>

        {/* ─── Core Topics Tested Grid ─── */}
        <section aria-labelledby="topics-heading" className="space-y-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 id="topics-heading" className="text-3xl font-bold font-display text-text-primary mb-3">
              What Hiring Managers Test in React Interviews
            </h2>
            <p className="text-text-secondary">
              Evalix evaluates your knowledge across core React pillars requested by FAANG and top tech companies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Virtual DOM & Reconciliation", desc: "Diffing algorithm, Fiber tree architecture, batching, and key prop semantics." },
              { title: "Hooks & Component Internals", desc: "Custom hooks, closure traps in useEffect, useMemo cache invalidation, and useRef mechanics." },
              { title: "State & Architecture", desc: "Zustand, Context API tradeoffs, server vs. client state, and scalable module design." },
              { title: "Performance Profiling", desc: "Eliminating unnecessary renders, windowing large lists, dynamic imports, and Web Vitals." }
            ].map((col, idx) => (
              <div key={idx} className="bg-bg-surface border-[1.5px] border-border-subtle rounded-[18px] p-6 hover:border-[#151515] transition-colors">
                <span className="text-xs font-mono font-bold text-[#FF6B35] block mb-3">/0{idx + 1}</span>
                <h3 className="text-lg font-bold font-display text-text-primary mb-2">{col.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{col.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Interactive Sample Questions ─── */}
        <section aria-labelledby="questions-heading" className="bg-bg-surface border border-border-subtle rounded-3xl p-8 lg:p-12">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono text-accent-glow uppercase tracking-widest block mb-2">Practice Preview</span>
            <h2 id="questions-heading" className="text-2xl sm:text-3xl font-bold font-display text-text-primary mb-3">
              Real React Interview Questions & Ideal Answers
            </h2>
            <p className="text-text-secondary">
              Here are typical high-signal questions Shristi asks during live mock sessions. Click each topic to review model answers.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
              {sampleQuestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveQuestion(idx)}
                  className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all ${
                    activeQuestion === idx 
                      ? 'bg-accent-primary/10 border-accent-primary text-text-primary font-semibold' 
                      : 'bg-bg-elevated border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-surface'
                  }`}
                >
                  <span className="text-xs font-mono text-accent-glow block mb-1">0{idx + 1}</span>
                  {item.topic}
                </button>
              ))}
            </div>

            <div className="lg:col-span-2 bg-bg-canvas border border-border-subtle rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-text-secondary uppercase tracking-wider block mb-2">
                  Topic: {sampleQuestions[activeQuestion].topic}
                </span>
                <h3 className="text-xl font-bold text-text-primary mb-4 font-display">
                  {sampleQuestions[activeQuestion].q}
                </h3>
                <div className="p-4 bg-bg-elevated border border-border-subtle rounded-xl text-text-secondary text-sm leading-relaxed mb-6">
                  <span className="font-semibold text-accent-glow block mb-1">Model Engineering Answer:</span>
                  {sampleQuestions[activeQuestion].a}
                </div>
              </div>

              <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-text-secondary">Ready to test yourself on voice?</span>
                <Link to="/register" className="bg-accent-primary text-white text-xs px-5 py-2.5 rounded-full font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5">
                  Try live with Shristi <FiArrowRight />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ Section ─── */}
        <section aria-labelledby="faq-heading" className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h2 id="faq-heading" className="text-3xl font-bold font-display text-text-primary mb-3">
              React Mock Interview FAQs
            </h2>
            <p className="text-text-secondary">
              Common questions on practicing frontend technical interviews with AI.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full p-5 text-left flex justify-between items-center gap-4 font-semibold text-text-primary hover:text-accent-glow transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <FiChevronDown className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-accent-primary' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-text-secondary text-sm leading-relaxed border-t border-border-subtle/50 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Bottom CTA ─── */}
        <section className="bg-bg-surface border border-border-subtle rounded-3xl p-10 text-center relative overflow-hidden">
          <div className="relative z-10 max-w-xl mx-auto space-y-4">
            <h2 className="text-3xl font-bold font-display text-text-primary">
              Ready to Ace Your React Developer Interview?
            </h2>
            <p className="text-text-secondary text-base">
              Get immediate constructive feedback on code structure, algorithmic efficiency, and communication clarity.
            </p>
            <div className="pt-2">
              <Link to="/register" className="inline-block bg-accent-primary text-white px-8 py-3.5 rounded-full font-bold text-base hover:opacity-90 shadow-lg shadow-accent-primary/20 transition-all">
                Start Free React Mock Interview
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8 text-center text-sm text-text-secondary">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>© {new Date().getFullYear()} Evalix. All rights reserved.</span>
          <div className="flex gap-6">
            <Link to="/" className="hover:text-text-primary">Home</Link>
            <Link to="/resume-based-interview-questions" className="hover:text-text-primary">Resume Questions</Link>
            <Link to="/system-design-mock-interview" className="hover:text-text-primary">System Design</Link>
            <Link to="/mock-interview-for-freshers" className="hover:text-text-primary">Freshers Prep</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ReactMockInterview;
