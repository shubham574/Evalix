import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FiAward, FiCode, FiBookOpen, FiArrowRight, 
  FiChevronDown, FiCheckCircle, FiUsers, FiHelpCircle, FiTarget 
} from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';

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

const FreshersMockInterview = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(0);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": "https://interview-ai-ten-psi.vercel.app/mock-interview-for-freshers#article",
        "headline": "AI Mock Interview for Freshers & College Graduates: Campus Placement Prep",
        "description": "Comprehensive AI mock interview practice for freshers, college graduates, and entry-level software engineers. Master DSA, OOP, DBMS, and HR rounds.",
        "url": "https://interview-ai-ten-psi.vercel.app/mock-interview-for-freshers",
        "publisher": {
          "@type": "Organization",
          "name": "Evalix",
          "url": "https://interview-ai-ten-psi.vercel.app/"
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

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary font-body overflow-x-clip">
      <SEOHead 
        title="AI Mock Interview for Freshers — Campus Placement Technical Prep"
        description="Practice realistic AI mock interviews for freshers and college graduates. Master CS fundamentals, DSA, DBMS, OOP, resume project defense, and HR questions with instant AI feedback."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/mock-interview-for-freshers"
        structuredData={structuredData}
      />

      {/* Header Bar */}
      <header className="border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md sticky top-0 z-50 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold font-display text-text-primary flex items-center gap-2">
            Evalix
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
              Log In
            </Link>
            <Link to="/register" className="bg-accent-primary text-white px-5 py-2 rounded-full font-semibold text-sm hover:opacity-90 transition-all shadow-md">
              Start Free Practice
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-6 py-16 space-y-24">
        {/* ─── Hero Section ─── */}
        <section className="text-center max-w-4xl mx-auto pt-8">
          <div className="inline-flex items-center space-x-2 bg-bg-elevated border border-border-subtle rounded-full px-4 py-1.5 mb-6 shadow-sm">
            <FiAward className="text-accent-primary" size={14} />
            <span className="text-xs font-mono text-text-secondary uppercase tracking-widest">Entry-Level & Campus Placement Track</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display tracking-tight text-text-primary mb-6">
            AI Mock Interview for <br className="hidden sm:block" />
            <span className="text-gradient">Freshers & College Graduates</span>
          </h1>

          <p className="text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10">
            Build unshakeable interview confidence before campus placement drives. Practice CS fundamentals, defend your college projects, and conquer technical and HR rounds with AI interviewer Shristi.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto bg-accent-primary text-white px-8 py-3.5 rounded-full font-bold text-base hover:opacity-90 shadow-lg shadow-accent-primary/25 transition-all flex items-center justify-center gap-2">
              <FiUsers size={18} /> Start Fresher Mock Interview
            </Link>
            <Link to="/#how-it-works" className="w-full sm:w-auto border border-border-subtle text-text-primary px-8 py-3.5 rounded-full font-medium text-base hover:bg-bg-elevated transition-colors">
              How Practice Works
            </Link>
          </div>
        </section>

        {/* ─── Core Freshers Pillars ─── */}
        <section aria-labelledby="fresher-topics-heading" className="space-y-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 id="fresher-topics-heading" className="text-3xl font-bold font-display text-text-primary mb-3">
              What Campus Recruiters Look For in Freshers
            </h2>
            <p className="text-text-secondary">
              Recruiters don't expect 10 years of experience — they look for clarity of fundamentals, clean problem-solving, and positive coachability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: FiCode, title: "Data Structures & Algorithmic Logic", desc: "Arrays, strings, linked lists, stacks, queues, trees, and time complexity Big-O analysis." },
              { icon: FiBookOpen, title: "Core CS Fundamentals", desc: "Object-Oriented Programming, DBMS normalization, SQL queries, OS process scheduling, and HTTP." },
              { icon: FiTarget, title: "Capstone Project Defense", desc: "Clearly explaining your project architecture, tech stack justification, and challenges solved." },
              { icon: FiUsers, title: "HR & Behavioral Confidence", desc: "Strengths, weaknesses, teamwork conflicts, and career aspirations structured using the STAR framework." }
            ].map((col, idx) => (
              <div key={idx} className="bg-bg-surface border border-border-subtle rounded-2xl p-6 hover:border-accent-primary/40 transition-colors">
                <div className="w-12 h-12 bg-accent-primary/10 text-accent-primary rounded-xl flex items-center justify-center mb-4">
                  <col.icon size={22} />
                </div>
                <h3 className="text-lg font-bold font-display text-text-primary mb-2">{col.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{col.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Interactive Sample Questions ─── */}
        <section aria-labelledby="fresher-sample-heading" className="bg-bg-surface border border-border-subtle rounded-3xl p-8 lg:p-12">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono text-accent-glow uppercase tracking-widest block mb-2">Campus Placement Simulator</span>
            <h2 id="fresher-sample-heading" className="text-2xl sm:text-3xl font-bold font-display text-text-primary mb-3">
              Top Placement Interview Questions & High-Scoring Answers
            </h2>
            <p className="text-text-secondary">
              Explore classic fresher technical questions and see how top candidates formulate clear, structured answers.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
              {fresherQuestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveQuestion(idx)}
                  className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all ${
                    activeQuestion === idx 
                      ? 'bg-accent-primary/10 border-accent-primary text-text-primary font-semibold' 
                      : 'bg-bg-elevated border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-surface'
                  }`}
                >
                  <span className="text-xs font-mono text-accent-glow block mb-1">Question 0{idx + 1}</span>
                  <p className="text-sm font-semibold text-text-primary">{item.topic}</p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-2 bg-bg-canvas border border-border-subtle rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-text-secondary uppercase tracking-wider block mb-2">
                  Topic: {fresherQuestions[activeQuestion].topic}
                </span>
                <h3 className="text-xl font-bold text-text-primary mb-4 font-display">
                  {fresherQuestions[activeQuestion].q}
                </h3>
                <div className="p-4 bg-bg-elevated border border-border-subtle rounded-xl text-text-secondary text-sm leading-relaxed mb-6">
                  <span className="font-semibold text-accent-glow block mb-1">Model High-Scoring Answer:</span>
                  {fresherQuestions[activeQuestion].a}
                </div>
              </div>

              <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-text-secondary">Ready to practice speaking your answers out loud?</span>
                <Link to="/register" className="bg-accent-primary text-white text-xs px-5 py-2.5 rounded-full font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5">
                  Try with AI Shristi <FiArrowRight />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ Section ─── */}
        <section aria-labelledby="faq-heading" className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h2 id="faq-heading" className="text-3xl font-bold font-display text-text-primary mb-3">
              Frequently Asked Questions for Freshers
            </h2>
            <p className="text-text-secondary">
              Helpful advice for students and recent grads preparing for technical interviews.
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
              Land Your First Software Engineering Offer
            </h2>
            <p className="text-text-secondary text-base">
              Overcome placement anxiety with unlimited, judgment-free AI mock interviews. Receive constructive feedback and sharpen your answers today.
            </p>
            <div className="pt-2">
              <Link to="/register" className="inline-block bg-accent-primary text-white px-8 py-3.5 rounded-full font-bold text-base hover:opacity-90 shadow-lg shadow-accent-primary/20 transition-all">
                Start Free Placement Practice
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
            <Link to="/resume-based-interview-questions" className="hover:text-text-primary">Resume Questions</Link>
            <Link to="/system-design-mock-interview" className="hover:text-text-primary">System Design</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FreshersMockInterview;
