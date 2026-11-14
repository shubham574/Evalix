import React, { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiMessageSquare, FiChevronDown, FiChevronUp,
  FiClock, FiCheck, FiDownload, FiAlertCircle,
} from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import html2pdf from 'html2pdf.js';
import { useApiMutation, useApiQuery } from '../hooks/useApi';
import { API } from '../api/endpoints';
import { QUESTION_CATEGORIES } from '../utils/constants';
import SEOHead from '../components/common/SEOHead';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import api from '../api/axios';
import EvalixOrb from '../components/ui/EvalixOrb';

const InterviewQuestions = () => {
  const location = useLocation();
  const [jobRole, setJobRole] = useState(location.state?.jobRole || '');
  const [skills, setSkills] = useState(location.state?.skills || '');
  const [category, setCategory] = useState('technical');
  const [count, setCount] = useState('10');
  const [activeSet, setActiveSet] = useState(null);
  const [expandedQuestion, setExpandedQuestion] = useState(0);

  // Fetch past question sets
  const { data: pastSets, isLoading: isPastLoading } = useApiQuery(
    'questionSets',
    API.INTERVIEW.LIST
  );

  // Generate mutation
  const generateMutation = useApiMutation(API.INTERVIEW.GENERATE, 'post', {
    successMessage: 'Question bank generated!',
    invalidateQueries: ['questionSets'],
    onSuccess: (data) => {
      setActiveSet(data.data);
      setExpandedQuestion(0);
    },
  });

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!jobRole || !skills) return;

    generateMutation.mutate({
      jobRole,
      skills: skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      category,
      count: Number(count),
    });
  };

  const toggleQuestion = (index) => {
    setExpandedQuestion(expandedQuestion === index ? null : index);
  };

  // Fixed to use Clerk-authenticated axios instance
  const viewSavedSet = async (id) => {
    try {
      const { data } = await api.get(API.INTERVIEW.GET(id));
      setActiveSet(data.data);
      setExpandedQuestion(0);
    } catch (err) {
      console.error(err);
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const pdfContainerRef = useRef(null);

  const handleDownloadPDF = async () => {
    if (!activeSet) return;
    setIsDownloading(true);

    const element = pdfContainerRef.current;

    const opt = {
      margin: 10,
      filename: `${activeSet.jobRole}_Interview_Playbook.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    setTimeout(async () => {
      try {
        element.style.display = 'block';
        await html2pdf().set(opt).from(element).save();
      } catch (err) {
        console.error('PDF generation failed', err);
      } finally {
        element.style.display = 'none';
        setIsDownloading(false);
      }
    }, 100);
  };

  return (
    <div className="space-y-6 pb-10">
      <SEOHead title="Q&A Bank & Answer Playbooks — Evalix" />

      {/* Header */}
      <div className="border-b border-border-subtle pb-5">
        <h1 className="heading-page text-text-primary">Interview Question Bank</h1>
        <p className="text-sm sm:text-base text-text-secondary mt-1">
          Generate <strong className="text-text-primary font-semibold">5 to 20 role-specific questions</strong> across <strong className="text-text-primary font-semibold">Technical, Behavioral, or System Design</strong> tracks with reference answers and <strong className="text-text-primary font-semibold">1-click PDF export</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form & Saved Playbooks (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6 border border-border-subtle">
            <form onSubmit={handleGenerate} className="space-y-5">
              <Input
                id="jobRole"
                label="Target Role"
                placeholder="e.g., Backend Engineer"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                required
              />

              <Input
                id="skills"
                label="Specific Skills / Topics (comma separated)"
                placeholder="Node.js, PostgreSQL, Redis, System Design"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  id="category"
                  label="Category"
                  options={QUESTION_CATEGORIES}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />

                <Select
                  id="count"
                  label="Question Count"
                  options={[5, 10, 15, 20]}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={generateMutation.isPending}
                disabled={!jobRole || !skills}
              >
                Generate Question Set
              </Button>
            </form>
          </Card>

          {/* Saved Question Sets */}
          <Card className="p-6 border border-border-subtle">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
              <h3 className="font-display font-bold text-base text-text-primary">
                Saved Question Sets
              </h3>
              <span className="font-mono text-xs text-text-muted">
                {pastSets?.data?.length || 0}
              </span>
            </div>

            {isPastLoading ? (
              <div className="py-8 flex justify-center">
                <Loader size="sm" />
              </div>
            ) : pastSets?.data?.length > 0 ? (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {pastSets.data.map((set) => (
                  <div
                    key={set._id}
                    className={`p-3.5 rounded-[12px] border transition-all cursor-pointer ${
                      activeSet?._id === set._id
                        ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                        : 'border-border-subtle bg-bg-canvas hover:border-text-primary'
                    }`}
                    onClick={() => viewSavedSet(set._id)}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h4
                        className="font-display font-bold text-sm text-text-primary truncate"
                        title={set.jobRole}
                      >
                        {set.jobRole}
                      </h4>
                      <span className="text-[11px] font-mono text-text-muted flex-shrink-0">
                        {new Date(set.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Badge variant="default" className="capitalize">
                      {set.category?.replace('-', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted text-center py-6">
                No saved question sets yet.
              </p>
            )}
          </Card>
        </div>

        {/* Right Column: Active Playbook (8 cols) */}
        <div className="lg:col-span-8">
          {generateMutation.isPending ? (
            <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-12 flex flex-col items-center justify-center min-h-[500px] text-center">
              <EvalixOrb size="lg" state="thinking" />
              <h3 className="heading-card text-[#F8F5EF] mt-5">
                Generating {count} {category} Questions for {jobRole}...
              </h3>
              <p className="text-sm text-[#F8F5EF]/65 mt-2 max-w-md">
                Writing reference answers, key talking points, and common mistakes to avoid.
              </p>
            </div>
          ) : activeSet ? (
            <div className="space-y-6 animate-fade-in">
              {/* Top Action Header */}
              <div className="rounded-[22px] bg-[#151515] text-[#F8F5EF] p-6 border border-[#2E2E2E] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#C7F36B] text-[#151515] font-mono text-xs font-bold uppercase">
                      {activeSet.category?.replace('-', ' ')}
                    </span>
                    <span className="text-xs font-mono text-[#F8F5EF]/65">
                      {activeSet.questions.length} Questions
                    </span>
                  </div>
                  <h2 className="heading-section text-[#F8F5EF]">{activeSet.jobRole}</h2>
                </div>
                <div className="flex items-center gap-2.5">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleDownloadPDF}
                    loading={isDownloading}
                    icon={FiDownload}
                  >
                    Export PDF
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setActiveSet(null)}>
                    Close
                  </Button>
                </div>
              </div>

              {/* Hidden Container for PDF Export */}
              <div
                ref={pdfContainerRef}
                style={{ display: 'none', padding: '20px', background: '#fff', color: '#151515' }}
                className="pdf-export-container"
              >
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {activeSet.jobRole} — Evalix Interview Playbook
                </h1>
                <p style={{ marginBottom: '20px', color: '#555' }}>
                  Category: {activeSet.category?.replace('-', ' ')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {activeSet.questions.map((q, qIndex) => (
                    <div
                      key={qIndex}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '16px',
                      }}
                    >
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '14px' }}>
                        <span style={{ color: '#FF6B35', marginRight: '8px' }}>
                          Q{qIndex + 1}.
                        </span>
                        {q.question}
                      </h3>

                      <div style={{ marginBottom: '16px' }}>
                        <h4
                          style={{
                            fontSize: '13px',
                            fontWeight: 'bold',
                            color: '#FF6B35',
                            textTransform: 'uppercase',
                            marginBottom: '8px',
                          }}
                        >
                          Ideal Answer
                        </h4>
                        <div
                          style={{
                            padding: '12px',
                            backgroundColor: '#F8F5EF',
                            borderRadius: '8px',
                            fontSize: '14px',
                            lineHeight: '1.6',
                          }}
                        >
                          <ReactMarkdown className="prose prose-sm max-w-none">
                            {q.idealAnswer}
                          </ReactMarkdown>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '20px' }}>
                        <div style={{ flex: 1 }}>
                          <h4
                            style={{
                              fontSize: '13px',
                              fontWeight: 'bold',
                              color: '#10b981',
                              textTransform: 'uppercase',
                              marginBottom: '8px',
                            }}
                          >
                            Key Points to Cover
                          </h4>
                          <ul
                            style={{
                              margin: 0,
                              padding: 0,
                              listStyle: 'none',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            {q.keyPoints?.map((point, pIdx) => (
                              <li
                                key={pIdx}
                                style={{
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                }}
                              >
                                <span style={{ color: '#10b981', marginRight: '8px' }}>•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div style={{ flex: 1 }}>
                          <h4
                            style={{
                              fontSize: '13px',
                              fontWeight: 'bold',
                              color: '#ef4444',
                              textTransform: 'uppercase',
                              marginBottom: '8px',
                            }}
                          >
                            Common Pitfalls
                          </h4>
                          <ul
                            style={{
                              margin: 0,
                              padding: 0,
                              listStyle: 'none',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            {q.commonMistakes?.map((mistake, mIdx) => (
                              <li
                                key={mIdx}
                                style={{
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                }}
                              >
                                <span style={{ color: '#ef4444', marginRight: '8px' }}>•</span>
                                <span>{mistake}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Accordion Questions List */}
              <div className="space-y-4">
                {activeSet.questions.map((q, qIndex) => {
                  const isOpen = expandedQuestion === qIndex;
                  return (
                    <div
                      key={qIndex}
                      className="border-2 border-border-subtle rounded-[18px] bg-bg-surface overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        className="w-full text-left p-5 flex justify-between items-start gap-4 hover:bg-bg-canvas transition-colors cursor-pointer"
                        onClick={() => toggleQuestion(qIndex)}
                      >
                        <div className="flex items-start gap-3">
                          <span className="px-2.5 py-1 rounded-[8px] bg-[#151515] text-[#C7F36B] font-mono text-xs font-bold flex-shrink-0 mt-0.5">
                            Q{String(qIndex + 1).padStart(2, '0')}
                          </span>
                          <h3 className="font-display font-bold text-base sm:text-lg text-text-primary leading-snug">
                            {q.question}
                          </h3>
                        </div>
                        <div className="mt-1 flex-shrink-0 text-text-muted">
                          {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t-2 border-border-subtle bg-bg-canvas"
                          >
                            <div className="p-6 space-y-6">
                              {/* Ideal Answer */}
                              <div>
                                <span className="text-xs font-mono font-bold text-[#FF6B35] uppercase tracking-widest block mb-2">
                                  Model High-Signal Answer
                                </span>
                                <div className="p-4 rounded-[14px] bg-bg-surface border border-border-subtle text-text-primary text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown>{q.idealAnswer}</ReactMarkdown>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Key Points */}
                                <div className="p-4 rounded-[14px] bg-bg-surface border border-border-subtle">
                                  <h4 className="text-xs font-mono font-bold text-emerald-600 dark:text-[#C7F36B] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <FiCheck /> Must-Include Talking Points
                                  </h4>
                                  <ul className="space-y-2">
                                    {q.keyPoints?.map((point, pIdx) => (
                                      <li
                                        key={pIdx}
                                        className="flex items-start gap-2 text-xs sm:text-sm text-text-secondary"
                                      >
                                        <span className="text-emerald-600 dark:text-[#C7F36B] font-bold">
                                          •
                                        </span>
                                        <span>{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Common Mistakes */}
                                <div className="p-4 rounded-[14px] bg-bg-surface border border-border-subtle">
                                  <h4 className="text-xs font-mono font-bold text-[#EF4444] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <FiAlertCircle /> Common Candidate Pitfalls
                                  </h4>
                                  <ul className="space-y-2">
                                    {q.commonMistakes?.map((mistake, mIdx) => (
                                      <li
                                        key={mIdx}
                                        className="flex items-start gap-2 text-xs sm:text-sm text-text-secondary"
                                      >
                                        <span className="text-[#EF4444] font-bold">•</span>
                                        <span>{mistake}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card className="p-10 border-2 border-border-subtle min-h-[500px] flex flex-col justify-center items-center text-center">
              <EvalixOrb size="lg" state="idle" />
              <span className="mt-5 px-3 py-1 rounded-full bg-bg-canvas border border-border-subtle font-mono text-xs uppercase tracking-wider text-text-secondary">
                Role-Specific Answer Playbooks
              </span>
              <h3 className="heading-card text-text-primary mt-3">
                Master Every Question Before the Call
              </h3>
              <p className="text-sm text-text-secondary mt-2 max-w-md">
                Enter your target role and skills on the left to generate curated interview questions with model answers and downloadable PDF study sheets.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewQuestions;
