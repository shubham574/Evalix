import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FiFileText, FiTarget, FiZap, FiArrowRight, 
  FiChevronDown, FiCheckCircle, FiShield, FiTrendingUp 
} from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';

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

const ResumeQuestions = () => {
  const [openFaq, setOpenFaq] = useState(null);
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

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary font-body overflow-x-clip">
      <SEOHead 
        title="Resume-Based Interview Questions — AI Tailored Mock Prep"
        description="Upload your PDF resume to generate tailored technical and behavioral interview questions with instant AI feedback."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/resume-based-interview-questions"
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
              Upload Resume Free
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-6 py-16 space-y-24">
        {/* ─── Hero Section ─── */}
        <section className="text-center max-w-4xl mx-auto pt-8">
          <div className="inline-flex items-center space-x-2 bg-bg-surface border-[1.5px] border-[#151515] shadow-[2px_2px_0px_#151515] rounded-[10px] px-4 py-1.5 mb-6">
            <FiFileText className="text-[#FF6B35]" size={14} />
            <span className="text-xs font-mono text-text-primary font-bold uppercase tracking-widest">Resume-Driven AI Analysis</span>
          </div>

          <h1 className="heading-section text-text-primary mb-6">
            Resume-Based <br className="hidden sm:block" />
            <span className="inline-block px-3 py-0.5 rounded-[12px] bg-[#FF6B35] text-white mt-1">Interview Questions & AI Prep</span>
          </h1>

          <p className="text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10">
            Never get blindsided by questions about your past projects. Upload your resume to generate targeted, recruiter-grade technical and behavioral questions tailored to your experience.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto bg-[#FF6B35] text-white px-8 py-3.5 rounded-[12px] font-display font-bold text-base shadow-[0_3px_0_#151515] hover:bg-[#EB5822] transition-all flex items-center justify-center gap-2">
              <FiZap size={18} /> Analyze My Resume Free
            </Link>
            <Link to="/#how-it-works" className="w-full sm:w-auto bg-bg-surface border border-border-subtle text-text-primary px-8 py-3.5 rounded-[12px] font-display font-semibold text-base hover:border-[#151515] transition-colors">
              See How It Works
            </Link>
          </div>
        </section>

        {/* ─── 4 Pillars Section ─── */}
        <section aria-labelledby="pillars-heading" className="space-y-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 id="pillars-heading" className="text-3xl font-bold font-display text-text-primary mb-3">
              How Evalix Analyzes Your Resume
            </h2>
            <p className="text-text-secondary">
              Hiring managers inspect your resume for specific claims, metrics, and technical depth. Evalix replicates their evaluation methodology.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Project Claim Validation", desc: "Drills into your biggest bullet points to verify architecture, design patterns, and hands-on implementation." },
              { title: "Metrics & Impact Defense", desc: "Questions the numbers on your resume (e.g. 'reduced latency by 40%') to ensure you can explain the exact benchmarks." },
              { title: "ATS & JD Skill Gap Analysis", desc: "Compares your resume against target job postings to reveal blind spots before hiring managers spot them." },
              { title: "STAR Story Alignment", desc: "Structures behavioral responses using Situation, Task, Action, and Result to maximize recruiter scorecards." }
            ].map((col, idx) => (
              <div key={idx} className="bg-bg-surface border-[1.5px] border-border-subtle rounded-[18px] p-6 hover:border-[#151515] transition-colors">
                <span className="text-xs font-mono font-bold text-[#FF6B35] block mb-3">/0{idx + 1}</span>
                <h3 className="text-lg font-bold font-display text-text-primary mb-2">{col.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{col.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Interactive Resume-to-Question Simulator ─── */}
        <section aria-labelledby="simulator-heading" className="bg-bg-surface border border-border-subtle rounded-3xl p-8 lg:p-12">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono text-accent-glow uppercase tracking-widest block mb-2">Live Demonstration</span>
            <h2 id="simulator-heading" className="text-2xl sm:text-3xl font-bold font-display text-text-primary mb-3">
              Sample Resume Bullets & Generated Questions
            </h2>
            <p className="text-text-secondary">
              See how our AI transforms typical resume bullet points into penetrating technical interview questions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
              {sampleResumeSnippets.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSnippet(idx)}
                  className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all ${
                    activeSnippet === idx 
                      ? 'bg-accent-primary/10 border-accent-primary text-text-primary font-semibold' 
                      : 'bg-bg-elevated border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-surface'
                  }`}
                >
                  <span className="text-xs font-mono text-accent-glow block mb-1">{item.role}</span>
                  <p className="line-clamp-2 text-xs text-text-secondary">{item.bullet}</p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-2 bg-bg-canvas border border-border-subtle rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="mb-4">
                  <span className="text-xs font-mono text-text-secondary uppercase tracking-wider block mb-1">
                    Resume Bullet Point:
                  </span>
                  <div className="p-3 bg-bg-elevated rounded-lg border border-border-subtle text-sm text-text-primary italic">
                    "{sampleResumeSnippets[activeSnippet].bullet}"
                  </div>
                </div>

                <div className="mb-5">
                  <span className="text-xs font-mono text-accent-primary uppercase tracking-wider block mb-1">
                    AI Interviewer Question:
                  </span>
                  <h3 className="text-lg font-bold text-text-primary font-display">
                    {sampleResumeSnippets[activeSnippet].aiQuestion}
                  </h3>
                </div>

                <div className="p-4 bg-bg-elevated border border-border-subtle rounded-xl text-text-secondary text-sm leading-relaxed mb-6">
                  <span className="font-semibold text-accent-glow block mb-1">Model High-Score Response:</span>
                  {sampleResumeSnippets[activeSnippet].answer}
                </div>
              </div>

              <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-text-secondary">Ready to test your own resume?</span>
                <Link to="/register" className="bg-accent-primary text-white text-xs px-5 py-2.5 rounded-full font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5">
                  Upload Your PDF Resume <FiArrowRight />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ Section ─── */}
        <section aria-labelledby="faq-heading" className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h2 id="faq-heading" className="text-3xl font-bold font-display text-text-primary mb-3">
              Resume-Based Questions FAQ
            </h2>
            <p className="text-text-secondary">
              Everything you need to know about preparing for project defense rounds.
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
              Turn Your Resume into Interview Confidence
            </h2>
            <p className="text-text-secondary text-base">
              Upload your resume in seconds, uncover your technical weak spots, and practice answering with AI interviewer Shristi.
            </p>
            <div className="pt-2">
              <Link to="/register" className="inline-block bg-accent-primary text-white px-8 py-3.5 rounded-full font-bold text-base hover:opacity-90 shadow-lg shadow-accent-primary/20 transition-all">
                Start Resume Mock Interview
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
            <Link to="/mock-interview-for-react-developers" className="hover:text-text-primary">React Prep</Link>
            <Link to="/system-design-mock-interview" className="hover:text-text-primary">System Design</Link>
            <Link to="/mock-interview-for-freshers" className="hover:text-text-primary">Freshers Prep</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ResumeQuestions;
