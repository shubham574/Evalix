import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FiAward, FiCode, FiBookOpen, FiArrowRight, FiUsers, FiTarget } from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';
import { Button } from '@/components/shadcn/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/shadcn/accordion';
import { Aura, Eyebrow, Reveal } from '@/components/studio';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

const fresherQuestions = [
  {
    topic: "Data Structures & Time Complexity",
    q: "Explain the difference between an Array and a Linked List in memory. When would you prefer one over the other?",
    a: "Arrays store elements in contiguous memory locations, enabling O(1) random access by index, but resizing and arbitrary insertions are O(n). Linked Lists store elements dynamically in non-contiguous memory connected by pointers, allowing O(1) insertions at known nodes, but access requires O(n) traversal and adds memory overhead for pointers. Choose arrays for frequent index-based lookups and cache locality; choose linked lists for frequent insertions/deletions without predictable sizes."
  },
  {
    topic: "Object-Oriented Programming (OOP)",
    q: "What is Polymorphism, and how does Compile-Time Polymorphism differ from Runtime Polymorphism?",
    a: "Polymorphism allows objects of different classes to respond to the same method call appropriately. Compile-time polymorphism (Method Overloading) occurs when multiple methods in the same class share the same name with different parameter signatures, resolved by the compiler. Runtime polymorphism (Method Overriding) occurs when a subclass provides a specific implementation of a method defined in its superclass, resolved at runtime using virtual method tables (dynamic method dispatch)."
  },
  {
    topic: "Database Management Systems (DBMS)",
    q: "What are the ACID properties in relational databases, and why are they crucial?",
    a: "ACID stands for: Atomicity (all operations within a transaction succeed or all rollback), Consistency (transactions transition the database from one valid state to another complying with constraints), Isolation (concurrent transactions execute independently without interference), and Durability (committed transactions survive system crashes). They prevent data corruption in critical systems like banking, orders, and authentication."
  },
  {
    topic: "Final Year Project & Behavioral Defense",
    q: "Tell me about your capstone project. What was the most challenging technical roadblock you solved?",
    a: "Frame your answer using the STAR method: 1) Situation: State the project purpose and target problem, 2) Task: Clarify your individual role on the team, 3) Action: Explain the technical hurdle (e.g. state management bug, API rate limiting, database normalization issue) and how you debugged and resolved it, 4) Result: Quantify the outcome (e.g., successful deployment, latency reduction, user feedback, or grade)."
  }
];

const faqs = [
  {
    q: "Is Evalix suitable for freshers and college campus placements?",
    a: "Yes! Evalix is specifically calibrated to help college graduates and freshers practice core computer science fundamentals (DSA, OOP, DBMS, OS, Networking) as well as explaining college projects and behavioral questions with confidence."
  },
  {
    q: "I get nervous speaking during interviews. How does Shristi help?",
    a: "Evalix provides a zero-judgment, private practice environment. You can repeat interview questions as many times as you need, get speech clarity scores, and learn how to structure your answers before facing real recruiters."
  },
  {
    q: "Can I practice coding assessment MCQs for company placement tests?",
    a: "Yes. In addition to conversational voice mock interviews, Evalix includes an instant MCQ Assessment Generator covering CS fundamentals, language concepts (Java, Python, C++, JavaScript), and logic puzzles typical of campus placement online rounds."
  },
  {
    q: "Do I have to pay anything to start practicing?",
    a: "No, Evalix has a free tier that gives freshers immediate access to mock interviews, resume scanning, and assessment tests without a credit card."
  }
];

const pillars = [
  { title: "Data Structures & Algorithmic Logic", desc: "Arrays, strings, linked lists, stacks, queues, trees, and time complexity Big-O analysis.", icon: FiCode },
  { title: "Core CS Fundamentals", desc: "Object-Oriented Programming, DBMS normalization, SQL queries, OS process scheduling, and HTTP.", icon: FiBookOpen },
  { title: "Capstone Project Defense", desc: "Clearly explaining your project architecture, tech stack justification, and challenges solved.", icon: FiTarget },
  { title: "HR & Behavioral Confidence", desc: "Strengths, weaknesses, teamwork conflicts, and career aspirations structured using the STAR framework.", icon: FiUsers }
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

const FreshersMockInterview = () => {
  useSmoothScroll();
  const [activeQuestion, setActiveQuestion] = useState(0);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": "https://interview-ai-ten-psi.vercel.app/mock-interview-for-freshers#article",
        "headline": "AI Mock Interview for Freshers & College Graduates: Campus Placement Prep",
        "description": "Comprehensive AI mock interview practice for freshers, college graduates, and entry-level software engineers. Master DSA, OOP, DBMS, and HR rounds.",
        "image": "https://interview-ai-ten-psi.vercel.app/og-image.png",
        "datePublished": "2026-01-15",
        "dateModified": "2026-11-12",
        "author": {
          "@type": "Organization",
          "name": "Evalix",
          "url": "https://interview-ai-ten-psi.vercel.app/"
        },
        "url": "https://interview-ai-ten-psi.vercel.app/mock-interview-for-freshers",
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
        "@id": "https://interview-ai-ten-psi.vercel.app/mock-interview-for-freshers#faq",
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

  const active = fresherQuestions[activeQuestion];

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary font-body overflow-x-clip">
      <SEOHead
        title="AI Mock Interview for Freshers — Campus Placement Technical Prep"
        description="Practice AI mock interviews for freshers and new grads covering DSA, OOP, DBMS, SQL, and final-year project defense."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/mock-interview-for-freshers"
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
              className="glass shadow-xs inline-flex items-center gap-2.5 rounded-full pl-2 pr-4 py-1.5 mb-8 max-w-full"
            >
              <span className="w-7 h-7 shrink-0 rounded-full bg-bg-surface flex items-center justify-center text-[#1D9E4B] shadow-xs">
                <FiAward size={14} />
              </span>
              <span className="eyebrow leading-snug text-left">Entry-Level &amp; Campus Placement Track</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              className="heading-section text-text-primary text-balance mb-7"
            >
              AI Mock Interview for <br className="hidden sm:block" />
              <span className="serif italic text-[#1D9E4B]">Freshers &amp; College Graduates</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
              className="text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10 text-pretty"
            >
              Build unshakeable interview confidence before campus placement drives. Practice CS fundamentals, defend your college projects, and conquer technical and HR rounds with AI interviewer Shristi.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.26 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/register">
                  <FiUsers size={18} /> Start Fresher Mock Interview
                </Link>
              </Button>
              <Button asChild size="lg" variant="glass" className="w-full sm:w-auto">
                <Link to="/#how-it-works">How Practice Works</Link>
              </Button>
            </motion.div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-5 sm:px-6 pb-24 space-y-24 sm:space-y-32">
          {/* ─── Core Freshers Pillars ─── */}
          <section aria-labelledby="fresher-topics-heading" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            <Reveal className="lg:col-span-5 lg:sticky lg:top-28 self-start space-y-5">
              <Eyebrow index="01">What recruiters want</Eyebrow>
              <h2 id="fresher-topics-heading" className="heading-page text-text-primary text-balance">
                What Campus Recruiters <span className="serif italic text-[#1D9E4B]">Look For in Freshers</span>
              </h2>
              <p className="text-text-secondary leading-relaxed max-w-md">
                Recruiters don't expect 10 years of experience — they look for clarity of fundamentals, clean problem-solving, and positive coachability.
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

          {/* ─── Interactive Sample Questions ─── */}
          <Reveal>
            <section aria-labelledby="fresher-sample-heading" className="bg-bg-surface border border-border-subtle rounded-[32px] shadow-sm p-6 sm:p-10 lg:p-12">
              <div className="max-w-2xl mb-10 space-y-4">
                <Eyebrow index="02">Campus Placement Simulator</Eyebrow>
                <h2 id="fresher-sample-heading" className="heading-page text-text-primary text-balance">
                  Top Placement Interview Questions &amp; <span className="serif italic text-[#1D9E4B]">High-Scoring Answers</span>
                </h2>
                <p className="text-text-secondary leading-relaxed">
                  Explore classic fresher technical questions and see how top candidates formulate clear, structured answers.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                <div className="space-y-2.5">
                  {fresherQuestions.map((item, idx) => {
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
                        <span className={`font-mono text-[11px] block mb-1.5 ${isActive ? 'text-[#167A3A]' : 'text-text-muted'}`}>Question 0{idx + 1}</span>
                        <p className="font-display font-normal text-[15px] tracking-[-0.02em] text-text-primary">{item.topic}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="lg:col-span-2 min-w-0 relative overflow-hidden bg-bg-canvas border border-border-subtle rounded-[24px] p-6 sm:p-8 flex flex-col justify-between">
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
                        <span className="font-display font-normal text-[#5B4BE0] block mb-2">Model High-Scoring Answer:</span>
                        {active.a}
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  <div className="pt-5 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="text-sm text-text-secondary text-center sm:text-left">Ready to practice speaking your answers out loud?</span>
                    <Button asChild size="sm">
                      <Link to="/register">
                        Try with AI Shristi <FiArrowRight />
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
                Frequently Asked Questions <span className="serif italic text-[#1D9E4B]">for Freshers</span>
              </h2>
              <p className="text-text-secondary">
                Helpful advice for students and recent grads preparing for technical interviews.
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
                  Land Your First <span className="serif italic text-[#1D9E4B]">Software Engineering Offer</span>
                </h2>
                <p className="text-text-secondary text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                  Overcome placement anxiety with unlimited, judgment-free AI mock interviews. Receive constructive feedback and sharpen your answers today.
                </p>
                <div className="pt-2">
                  <Button asChild size="xl">
                    <Link to="/register">
                      Start Free Placement Practice <FiArrowRight />
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
            <Link to="/resume-based-interview-questions" className="link-underline hover:text-text-primary">Resume Questions</Link>
            <Link to="/system-design-mock-interview" className="link-underline hover:text-text-primary">System Design</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default FreshersMockInterview;
