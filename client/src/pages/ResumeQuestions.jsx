import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FiFileText, FiTarget, FiZap, FiArrowRight, FiCheckCircle, FiTrendingUp } from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';
import { Button } from '@/components/shadcn/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/shadcn/accordion';
import { Aura, Eyebrow, Reveal } from '@/components/studio';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

const sampleResumeSnippets = [
  {
    role: "Full Stack Engineer (Node.js & React)",
    bullet: "Built real-time messaging pipeline handling 25,000 WebSocket connections with Redis Pub/Sub.",
    aiQuestion: "How did you handle WebSocket connection drops and message deduplication under high load in Redis Pub/Sub?",
    answer: "We implemented client-side exponential backoff for reconnection and a persistent ack queue in Redis Streams. Each message carried a unique idempotent UUID; before processing, workers checked a Redis bloom filter and deduplication cache to ensure at-most-once delivery."
  },
  {
    role: "Backend Engineer (Microservices)",
    bullet: "Migrated legacy monolith to Dockerized Go microservices, reducing p99 latency by 45%.",
    aiQuestion: "Walk me through how you decomposed the monolith database without causing distributed transaction failures.",
    answer: "We followed the Saga pattern using an orchestrated event bus rather than two-phase commit. For services requiring eventual consistency, compensating transactions were registered to roll back partial state mutations upon failure."
  },
  {
    role: "Frontend Engineer (TypeScript & Next.js)",
    bullet: "Optimized Core Web Vitals across e-commerce storefront, improving LCP from 3.8s to 1.1s.",
    aiQuestion: "Which specific assets were degrading LCP, and what technical changes did you make to hit 1.1 seconds?",
    answer: "The largest contentful paint was bottlenecked by unoptimized hero carousel images and render-blocking third-party scripts. We prioritized the hero banner via Next.js priority tags with AVIF formats, deferred analytics scripts using web workers via Partytown, and utilized ISR for pre-rendered product shells."
  },
  {
    role: "Data & ML Engineer",
    bullet: "Designed RAG pipeline using Pinecone vector database and Gemini 1.5 for semantic document search.",
    aiQuestion: "How did you benchmark retrieval chunking strategies and prevent vector drift over time?",
    answer: "We evaluated recursive character splitting with a 512-token window and 10% overlap against semantic chunking. Precision was validated using Hit Rate @ 5 and MRR (Mean Reciprocal Rank) metrics against human-annotated test queries, retraining embeddings during weekly re-indexing jobs."
  }
];

const faqs = [
  {
    q: "How does AI generate interview questions from my resume?",
    a: "Evalix uses Google Gemini 1.5 to parse your uploaded PDF resume. It identifies listed tech stacks, quantifiable achievements, and architectural claims, then formulates deep technical and behavioral drill-down questions exactly like an engineering hiring manager."
  },
  {
    q: "Can I provide a specific job description along with my resume?",
    a: "Yes! You can paste the target Job Description (JD). Evalix performs an ATS gap analysis, identifies missing competencies, and prioritizes questions tailored to match the specific job requirements."
  },
  {
    q: "Will the questions test both technical details and behavioral STAR stories?",
    a: "Absolutely. The AI crafts both technical deep-dives (architecture tradeoffs, scaling challenges, debugging war stories) and behavioral STAR questions (leadership, conflict resolution, project delivery under deadlines)."
  },
  {
    q: "Is my uploaded resume kept private and secure?",
    a: "Yes, your resume data is processed securely and temporarily in-memory for question synthesis. We do not sell or share your resume details with third-party advertisers."
  }
];

const pillars = [
  { title: "Project Claim Validation", desc: "Drills into your biggest bullet points to verify architecture, design patterns, and hands-on implementation.", icon: FiCheckCircle },
  { title: "Metrics & Impact Defense", desc: "Questions the numbers on your resume (e.g. 'reduced latency by 40%') to ensure you can explain the exact benchmarks.", icon: FiTrendingUp },
  { title: "ATS & JD Skill Gap Analysis", desc: "Compares your resume against target job postings to reveal blind spots before hiring managers spot them.", icon: FiTarget },
  { title: "STAR Story Alignment", desc: "Structures behavioral responses using Situation, Task, Action, and Result to maximize recruiter scorecards.", icon: FiFileText }
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

const ResumeQuestions = () => {
  useSmoothScroll();
  const [activeSnippet, setActiveSnippet] = useState(0);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": "https://interview-ai-ten-psi.vercel.app/resume-based-interview-questions#article",
        "headline": "Resume-Based Interview Questions & AI Mock Practice",
        "description": "Upload your resume to generate personalized technical and behavioral mock interview questions with instant AI evaluation.",
        "image": "https://interview-ai-ten-psi.vercel.app/og-image.png",
        "datePublished": "2026-01-15",
        "dateModified": "2026-11-12",
        "author": {
          "@type": "Organization",
          "name": "Evalix",
          "url": "https://interview-ai-ten-psi.vercel.app/"
        },
        "url": "https://interview-ai-ten-psi.vercel.app/resume-based-interview-questions",
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
        "@id": "https://interview-ai-ten-psi.vercel.app/resume-based-interview-questions#faq",
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

  const active = sampleResumeSnippets[activeSnippet];

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary font-body overflow-x-clip">
      <SEOHead
        title="Resume-Based Interview Questions — AI Tailored Mock Prep"
        description="Upload your PDF resume to generate tailored technical and behavioral interview questions with instant AI feedback."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/resume-based-interview-questions"
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
              <Link to="/register">Upload Resume Free</Link>
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
                <FiFileText size={14} />
              </span>
              <span className="eyebrow">Resume-Driven AI Analysis</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              className="heading-section text-text-primary text-balance mb-7"
            >
              Resume-Based <br className="hidden sm:block" />
              <span className="serif italic text-[#1D9E4B]">Interview Questions &amp; AI Prep</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
              className="text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10 text-pretty"
            >
              Never get blindsided by questions about your past projects. Upload your resume to generate targeted, recruiter-grade technical and behavioral questions tailored to your experience.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.26 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/register">
                  <FiZap size={18} /> Analyze My Resume Free
                </Link>
              </Button>
              <Button asChild size="lg" variant="glass" className="w-full sm:w-auto">
                <Link to="/#how-it-works">See How It Works</Link>
              </Button>
            </motion.div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-5 sm:px-6 pb-24 space-y-24 sm:space-y-32">
          {/* ─── 4 Pillars Section ─── */}
          <section aria-labelledby="pillars-heading" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            <Reveal className="lg:col-span-5 lg:sticky lg:top-28 self-start space-y-5">
              <Eyebrow index="01">The method</Eyebrow>
              <h2 id="pillars-heading" className="heading-page text-text-primary text-balance">
                How Evalix Analyzes <span className="serif italic text-[#1D9E4B]">Your Resume</span>
              </h2>
              <p className="text-text-secondary leading-relaxed max-w-md">
                Hiring managers inspect your resume for specific claims, metrics, and technical depth. Evalix replicates their evaluation methodology.
              </p>
            </Reveal>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {pillars.map((col, idx) => {
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

          {/* ─── Interactive Resume-to-Question Simulator ─── */}
          <Reveal>
            <section aria-labelledby="simulator-heading" className="bg-bg-surface border border-border-subtle rounded-[32px] shadow-sm p-6 sm:p-10 lg:p-12">
              <div className="max-w-2xl mb-10 space-y-4">
                <Eyebrow index="02">Live Demonstration</Eyebrow>
                <h2 id="simulator-heading" className="heading-page text-text-primary text-balance">
                  Sample Resume Bullets &amp; <span className="serif italic text-[#1D9E4B]">Generated Questions</span>
                </h2>
                <p className="text-text-secondary leading-relaxed">
                  See how our AI transforms typical resume bullet points into penetrating technical interview questions.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                <div className="space-y-2.5">
                  {sampleResumeSnippets.map((item, idx) => {
                    const isActive = activeSnippet === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setActiveSnippet(idx)}
                        className={`w-full text-left p-4 sm:p-5 rounded-[18px] border text-sm transition-all duration-300 cursor-pointer ${
                          isActive
                            ? 'bg-peach border-transparent text-text-primary shadow-xs'
                            : 'bg-bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                        }`}
                      >
                        <span className={`font-mono text-[11px] block mb-1.5 ${isActive ? 'text-[#167A3A]' : 'text-text-muted'}`}>{item.role}</span>
                        <p className="line-clamp-2 text-[13px] leading-relaxed text-text-secondary">{item.bullet}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="lg:col-span-2 relative overflow-hidden bg-bg-canvas border border-border-subtle rounded-[24px] p-6 sm:p-8 flex flex-col justify-between">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSnippet}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="mb-6">
                        <span className="eyebrow block mb-2.5">
                          Resume Bullet Point:
                        </span>
                        <div className="px-5 py-4 bg-bg-surface rounded-[18px] border border-border-subtle text-[15px] text-text-primary shadow-xs">
                          <span className="serif italic text-lg leading-snug">"{active.bullet}"</span>
                        </div>
                      </div>

                      <div className="mb-6">
                        <span className="eyebrow block mb-2.5">
                          <span className="text-[#167A3A]">AI Interviewer Question:</span>
                        </span>
                        <h3 className="font-display font-normal text-xl sm:text-2xl tracking-[-0.03em] leading-snug text-text-primary text-balance">
                          {active.aiQuestion}
                        </h3>
                      </div>

                      <div className="p-5 sm:p-6 bg-lilac rounded-[18px] text-text-secondary text-sm sm:text-[15px] leading-relaxed mb-6">
                        <span className="font-display font-normal text-[#5B4BE0] block mb-2">Model High-Score Response:</span>
                        {active.answer}
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  <div className="pt-5 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="text-sm text-text-secondary">Ready to test your own resume?</span>
                    <Button asChild size="sm">
                      <Link to="/register">
                        Upload Your PDF Resume <FiArrowRight />
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
                Resume-Based Questions <span className="serif italic text-[#1D9E4B]">FAQ</span>
              </h2>
              <p className="text-text-secondary">
                Everything you need to know about preparing for project defense rounds.
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
                  Turn Your Resume into <span className="serif italic text-[#1D9E4B]">Interview Confidence</span>
                </h2>
                <p className="text-text-secondary text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                  Upload your resume in seconds, uncover your technical weak spots, and practice answering with AI interviewer Shristi.
                </p>
                <div className="pt-2">
                  <Button asChild size="xl">
                    <Link to="/register">
                      Start Resume Mock Interview <FiArrowRight />
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
            <Link to="/mock-interview-for-react-developers" className="link-underline hover:text-text-primary">React Prep</Link>
            <Link to="/system-design-mock-interview" className="link-underline hover:text-text-primary">System Design</Link>
            <Link to="/mock-interview-for-freshers" className="link-underline hover:text-text-primary">Freshers Prep</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default ResumeQuestions;
