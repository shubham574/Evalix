import React, { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  FiMessageSquare, FiCheck, FiDownload, FiAlertCircle, FiX, FiBookOpen, FiLayers,
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
import Loader from '../components/ui/Loader';
import api from '../api/axios';
import EvalixOrb from '../components/ui/EvalixOrb';
import { PageHeader, Eyebrow, Reveal, Aura } from '@/components/studio';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/shadcn/accordion';

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
    <div className="pb-12">
      <SEOHead title="Q&A Bank & Answer Playbooks — Evalix" />

      <PageHeader
        eyebrow="Prep lab · Question bank"
        title="Rehearse every answer before"
        accent="the call"
        description={
          <>
            Generate <strong className="text-text-primary font-medium">5 to 20 role-specific questions</strong> across{' '}
            <strong className="text-text-primary font-medium">Technical, Behavioral, or System Design</strong> tracks with reference
            answers and <strong className="text-text-primary font-medium">1-click PDF export</strong>.
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form & Saved Playbooks */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 min-w-0">
          <Reveal>
            <Card padding="p-6 sm:p-8" className="rounded-[28px]">
              <div className="flex items-center gap-3.5 mb-7">
                <span className="w-10 h-10 rounded-full bg-lilac text-[#1D6FB8] dark:text-[#8EC1FF] flex items-center justify-center shrink-0">
                  <FiMessageSquare className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0">
                  <Eyebrow index="01">Configure</Eyebrow>
                  <h2 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary mt-1.5">
                    Build a playbook
                  </h2>
                </div>
              </div>

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
                  Generate question set
                </Button>
              </form>
            </Card>
          </Reveal>

          {/* Saved Question Sets */}
          <Reveal delay={0.08}>
            <Card padding="p-6 sm:p-7" className="rounded-[28px]">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-subtle">
                <h3 className="font-display font-normal tracking-[-0.03em] text-lg text-text-primary">
                  Saved question sets
                </h3>
                <span className="px-2.5 py-1 rounded-full bg-bg-elevated font-mono text-xs text-text-secondary">
                  {pastSets?.data?.length || 0}
                </span>
              </div>

              {isPastLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader size="sm" />
                </div>
              ) : pastSets?.data?.length > 0 ? (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 -mr-1">
                  {pastSets.data.map((set) => {
                    const isActive = activeSet?._id === set._id;
                    return (
                      <div
                        key={set._id}
                        className={`p-4 rounded-[18px] border transition-all duration-300 cursor-pointer ${
                          isActive
                            ? 'border-[#1D9E4B]/30 bg-peach'
                            : 'border-transparent bg-bg-elevated hover:bg-surface-hover hover:border-border-subtle'
                        }`}
                        onClick={() => viewSavedSet(set._id)}
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h4 className="font-medium text-sm text-text-primary truncate" title={set.jobRole}>
                            {set.jobRole}
                          </h4>
                          <span className="text-[11px] font-mono text-text-muted flex-shrink-0">
                            {new Date(set.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-bg-surface/80 text-text-secondary capitalize">
                          {set.category?.replace('-', ' ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center py-6">No saved question sets yet.</p>
              )}
            </Card>
          </Reveal>
        </div>

        {/* Right Column: Active Playbook */}
        <div className="lg:col-span-7 xl:col-span-8 min-w-0">
          {generateMutation.isPending ? (
            <div className="relative overflow-hidden rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-10 sm:p-14 flex flex-col items-center justify-center min-h-[520px] text-center">
              <Aura intensity={0.55} />
              <div className="relative flex flex-col items-center">
                <EvalixOrb size="lg" state="thinking" />
                <Eyebrow dot className="mt-7">Generating</Eyebrow>
                <h3 className="font-display font-normal tracking-[-0.035em] text-2xl sm:text-3xl text-text-primary mt-3 text-balance">
                  Generating {count} {category} questions for <span className="serif italic text-[#1D9E4B]">{jobRole}</span>…
                </h3>
                <p className="text-sm sm:text-[15px] text-text-secondary mt-3 max-w-md leading-relaxed">
                  Writing reference answers, key talking points, and common mistakes to avoid.
                </p>
              </div>
            </div>
          ) : activeSet ? (
            <div className="space-y-5 animate-fade-in">
              {/* Top Action Header */}
              <div className="relative overflow-hidden rounded-[28px] bg-peach border border-[#1D9E4B]/15 p-6 sm:p-8">
                <Aura intensity={0.3} />
                <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="px-3 py-1 rounded-full bg-bg-surface/80 text-text-primary text-xs font-medium capitalize">
                        {activeSet.category?.replace('-', ' ')}
                      </span>
                      <span className="eyebrow">{activeSet.questions.length} Questions</span>
                    </div>
                    <h2 className="heading-page text-text-primary break-words">{activeSet.jobRole}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleDownloadPDF}
                      loading={isDownloading}
                      icon={FiDownload}
                    >
                      Export PDF
                    </Button>
                    <Button variant="secondary" size="sm" icon={FiX} onClick={() => setActiveSet(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>

              {/* Hidden Container for PDF Export */}
              <div
                ref={pdfContainerRef}
                style={{ display: 'none', padding: '20px', background: '#fff', color: '#0F0F0F' }}
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
                        <span style={{ color: '#1D9E4B', marginRight: '8px' }}>
                          Q{qIndex + 1}.
                        </span>
                        {q.question}
                      </h3>

                      <div style={{ marginBottom: '16px' }}>
                        <h4
                          style={{
                            fontSize: '13px',
                            fontWeight: 'bold',
                            color: '#1D9E4B',
                            textTransform: 'uppercase',
                            marginBottom: '8px',
                          }}
                        >
                          Ideal Answer
                        </h4>
                        <div
                          style={{
                            padding: '12px',
                            backgroundColor: '#F8F9FB',
                            borderRadius: '8px',
                            fontSize: '14px',
                            lineHeight: '1.6',
                          }}
                        >
                          {/* react-markdown v10 no longer accepts className — wrap instead */}
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown>{q.idealAnswer}</ReactMarkdown>
                          </div>
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
              <Accordion
                type="single"
                collapsible
                value={expandedQuestion === null ? '' : String(expandedQuestion)}
                onValueChange={(v) => toggleQuestion(v === '' ? expandedQuestion : Number(v))}
                className="space-y-3"
              >
                {activeSet.questions.map((q, qIndex) => (
                  <AccordionItem
                    key={qIndex}
                    value={String(qIndex)}
                    className="border last:border border-border-subtle rounded-[24px] bg-bg-surface shadow-xs px-5 sm:px-7 transition-shadow duration-300 hover:shadow-sm data-[state=open]:shadow-md"
                  >
                    <AccordionTrigger className="py-5 sm:py-6 items-start hover:no-underline">
                      <span className="flex items-start gap-3.5 min-w-0">
                        <span className="px-2.5 py-1 rounded-full bg-peach text-[#167A3A] dark:text-[#6FD394] font-mono text-[11px] font-medium flex-shrink-0 mt-0.5 tracking-normal">
                          Q{String(qIndex + 1).padStart(2, '0')}
                        </span>
                        <span className="text-base sm:text-lg text-text-primary leading-snug">{q.question}</span>
                      </span>
                    </AccordionTrigger>

                    <AccordionContent className="pb-6 sm:pb-7 space-y-4">
                      {/* Ideal Answer */}
                      <div className="p-5 sm:p-6 rounded-[20px] bg-bg-elevated">
                        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#167A3A] dark:text-[#6FD394] mb-3">
                          <FiBookOpen /> Model High-Signal Answer
                        </span>
                        <div className="text-text-primary text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-normal prose-code:text-[#167A3A]">
                          <ReactMarkdown>{q.idealAnswer}</ReactMarkdown>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Key Points */}
                        <div className="p-5 rounded-[20px] bg-mint">
                          <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#2F6B12] dark:text-[#A8E07E] mb-3.5 flex items-center gap-2">
                            <FiCheck /> Must-Include Talking Points
                          </h4>
                          <ul className="space-y-2.5">
                            {q.keyPoints?.map((point, pIdx) => (
                              <li
                                key={pIdx}
                                className="flex items-start gap-2.5 text-sm text-text-primary/85 leading-relaxed"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-[#5DAA3A] mt-2 shrink-0" />
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Common Mistakes */}
                        <div className="p-5 rounded-[20px] bg-peach">
                          <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#167A3A] dark:text-[#6FD394] mb-3.5 flex items-center gap-2">
                            <FiAlertCircle /> Common Candidate Pitfalls
                          </h4>
                          <ul className="space-y-2.5">
                            {q.commonMistakes?.map((mistake, mIdx) => (
                              <li
                                key={mIdx}
                                className="flex items-start gap-2.5 text-sm text-text-primary/85 leading-relaxed"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E4B] mt-2 shrink-0" />
                                <span>{mistake}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-10 sm:p-14 min-h-[520px] flex flex-col justify-center items-center text-center">
              <Aura intensity={0.45} />
              <div className="relative flex flex-col items-center">
                <EvalixOrb size="lg" state="idle" />
                <Eyebrow dot className="mt-7">Role-specific answer playbooks</Eyebrow>
                <h3 className="font-display font-normal tracking-[-0.035em] text-2xl sm:text-3xl text-text-primary mt-3 text-balance">
                  Master every question <span className="serif italic text-[#1D9E4B]">before</span> the call
                </h3>
                <p className="text-sm sm:text-[15px] text-text-secondary mt-3 max-w-md leading-relaxed">
                  Enter your target role and skills to generate curated interview questions with model answers and downloadable
                  PDF study sheets.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-peach text-[#167A3A] dark:text-[#6FD394] text-xs font-medium">
                    <FiBookOpen /> Model answers
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mint text-[#2F6B12] dark:text-[#A8E07E] text-xs font-medium">
                    <FiCheck /> Talking points
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-lilac text-[#1D6FB8] dark:text-[#8EC1FF] text-xs font-medium">
                    <FiLayers /> PDF export
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewQuestions;
