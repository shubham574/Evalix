import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiBriefcase, FiFileText, FiChevronDown,
  FiCheckCircle, FiBookOpen, FiList, FiVideo,
  FiTarget, FiMap, FiLayers, FiRotateCcw, FiArrowUpRight, FiHash, FiUsers,
} from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import { useApiMutation, useApiQuery } from '../hooks/useApi';
import { API } from '../api/endpoints';
import { EXPERIENCE_LEVELS } from '../utils/constants';
import SEOHead from '../components/common/SEOHead';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import Modal from '../components/ui/Modal';
import EvalixOrb from '../components/ui/EvalixOrb';
import { PageHeader, Eyebrow, Reveal, Aura, NumberTicker } from '@/components/studio';

const SPRING = { type: 'spring', stiffness: 300, damping: 26 };

/** Small pastel icon bubble used in card headers. */
const IconBubble = ({ icon: Icon, tone = 'peach' }) => {
  const tones = {
    peach: 'bg-peach text-[#167A3A] dark:text-[#6FD394]',
    lilac: 'bg-lilac text-[#1D6FB8] dark:text-[#8EC1FF]',
    mint: 'bg-mint text-[#2F6B12] dark:text-[#A8E07E]',
    sky: 'bg-sky text-[#2563C9] dark:text-[#8DB8F2]',
    surface: 'bg-bg-surface/80 text-text-primary',
  };
  return (
    <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tones[tone] || tones.peach}`}>
      <Icon className="w-[18px] h-[18px]" />
    </span>
  );
};

const StudyMaterialModal = ({ isOpen, onClose, topic, jobRole }) => {
  const [content, setContent] = useState('');

  const generateMutation = useApiMutation(API.STUDY.GENERATE, 'post', {
    onSuccess: (data) => {
      setContent(data.data);
    },
  });

  useEffect(() => {
    if (isOpen && topic && !content) {
      generateMutation.mutate({ topic, jobRole });
    }
  }, [isOpen, topic]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setContent('');
      }}
      title={`AI Study Guide: ${topic}`}
      size="lg"
    >
      <div className="p-6 sm:p-7 max-h-[70vh] overflow-y-auto">
        {generateMutation.isPending ? (
          <div className="relative overflow-hidden rounded-[24px] bg-bg-elevated flex flex-col items-center justify-center py-14 px-6 text-center">
            <Aura intensity={0.5} />
            <div className="relative flex flex-col items-center">
              <EvalixOrb size="md" state="thinking" />
              <p className="mt-5 font-display font-normal tracking-[-0.02em] text-lg text-text-primary">
                Compiling deep-dive study guide…
              </p>
              <p className="text-sm text-text-secondary mt-1.5 max-w-sm">
                Synthesizing key concepts, interview talking points, and practical examples for {topic}.
              </p>
            </div>
          </div>
        ) : content ? (
          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-text-primary prose-headings:font-display prose-headings:font-normal prose-headings:tracking-[-0.03em] prose-a:text-[#1D9E4B]">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-danger bg-danger-bg rounded-[14px] px-4 py-3 text-sm font-medium">
            Failed to generate study material. Please try again.
          </p>
        )}
      </div>
    </Modal>
  );
};

const JobAnalysis = () => {
  const [jobRole, setJobRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('1-3 Years');
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [expandedWeek, setExpandedWeek] = useState(null);

  const [studyModalOpen, setStudyModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const navigate = useNavigate();

  // Fetch past analyses
  const { data: pastAnalyses, isLoading: isPastLoading } = useApiQuery(
    'jobAnalyses',
    API.JOB_ANALYSIS.LIST
  );

  // Analyze mutation
  const analyzeMutation = useApiMutation(API.JOB_ANALYSIS.ANALYZE, 'post', {
    successMessage: 'Job description decoded!',
    invalidateQueries: ['jobAnalyses'],
    onSuccess: (data) => {
      setActiveAnalysis(data.data);
    },
  });

  const handleAnalyze = (e) => {
    e.preventDefault();
    if (!jobRole || !jobDescription) return;

    analyzeMutation.mutate({
      jobRole,
      jobDescription,
      experienceLevel,
    });
  };

  return (
    <div className="pb-12">
      <SEOHead title="Job & JD Decoder — Evalix Prep Lab" />

      <PageHeader
        eyebrow="Prep lab · JD decoder"
        title="Decode any"
        accent="job description"
        description={
          <>
            Paste a job posting to extract <strong className="text-text-primary font-medium">technical skills</strong>,{' '}
            <strong className="text-text-primary font-medium">ATS keywords</strong>, and a{' '}
            <strong className="text-text-primary font-medium">week-by-week study roadmap</strong>.
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form */}
        <div className="lg:col-span-5 xl:col-span-4 min-w-0">
          <Reveal>
            <Card padding="p-6 sm:p-8" className="rounded-[28px]">
              <div className="flex items-center gap-3.5 mb-7">
                <IconBubble icon={FiTarget} tone="peach" />
                <div className="min-w-0">
                  <Eyebrow index="01">New analysis</Eyebrow>
                  <h2 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary mt-1.5">
                    Paste the role
                  </h2>
                </div>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-5">
                <Input
                  id="jobRole"
                  label="Target Role / Title"
                  placeholder="e.g., Senior React Developer"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  icon={FiBriefcase}
                  required
                />

                <Select
                  id="experience"
                  label="Your Experience Level"
                  options={EXPERIENCE_LEVELS}
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  required
                />

                <Input
                  id="jd"
                  label="Full Job Description"
                  placeholder="Paste responsibilities, requirements, and tech stack from the job listing..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  icon={FiFileText}
                  textarea
                  rows={10}
                  required
                />

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={analyzeMutation.isPending}
                  disabled={!jobRole || !jobDescription}
                >
                  Analyze job description
                </Button>
              </form>
            </Card>
          </Reveal>
        </div>

        {/* Right Column: Active Analysis or Recent Archive */}
        <div className="lg:col-span-7 xl:col-span-8 min-w-0">
          {analyzeMutation.isPending ? (
            <div className="relative overflow-hidden rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-10 sm:p-14 flex flex-col items-center justify-center min-h-[520px] text-center">
              <Aura intensity={0.55} />
              <div className="relative flex flex-col items-center">
                <EvalixOrb size="lg" state="thinking" />
                <Eyebrow dot className="mt-7">Decoding</Eyebrow>
                <h3 className="font-display font-normal tracking-[-0.035em] text-2xl sm:text-3xl text-text-primary mt-3 text-balance">
                  Analyzing <span className="serif italic text-[#1D9E4B]">{jobRole}</span> requirements…
                </h3>
                <p className="text-sm sm:text-[15px] text-text-secondary mt-3 max-w-md leading-relaxed">
                  Extracting required technical skills, priority interview topics, and a week-by-week preparation schedule.
                </p>
              </div>
            </div>
          ) : activeAnalysis ? (
            <div className="space-y-6 animate-fade-in">
              {/* Header Banner */}
              <div className="relative overflow-hidden rounded-[28px] bg-lilac border border-[#2496ED]/15 p-6 sm:p-8">
                <Aura intensity={0.35} />
                <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="px-3 py-1 rounded-full bg-bg-surface/80 text-text-primary text-xs font-medium">
                        {activeAnalysis.experienceLevel}
                      </span>
                      <span className="eyebrow">Role breakdown</span>
                    </div>
                    <h2 className="heading-page text-text-primary break-words">{activeAnalysis.jobRole}</h2>
                  </div>
                  <div className="flex items-end gap-5 shrink-0">
                    <div className="text-left sm:text-right">
                      <NumberTicker
                        value={activeAnalysis.technicalSkills?.length || 0}
                        className="font-display font-normal tracking-[-0.05em] text-5xl leading-none text-text-primary"
                      />
                      <p className="text-xs text-text-secondary mt-1.5">Technical Skills Identified</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={FiRotateCcw}
                      onClick={() => setActiveAnalysis(null)}
                    >
                      All analyses
                    </Button>
                  </div>
                </div>
              </div>

              {/* Skills & Keywords Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Technical Skills */}
                <Card padding="p-6 sm:p-7" className="md:row-span-2">
                  <div className="flex items-center gap-3 mb-6">
                    <IconBubble icon={FiLayers} tone="peach" />
                    <h3 className="font-display font-normal tracking-[-0.03em] text-lg text-text-primary">Technical stack</h3>
                  </div>

                  <div className="space-y-5">
                    {['Expert', 'Intermediate', 'Beginner'].map((level) => {
                      const skills =
                        activeAnalysis.technicalSkills?.filter(
                          (s) => s.proficiency?.includes(level) || s.proficiency === level
                        ) || [];
                      if (skills.length === 0) return null;

                      return (
                        <div key={level}>
                          <p className="eyebrow mb-2.5">{level} Proficiency</p>
                          <div className="flex flex-wrap gap-2">
                            {skills.map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1.5 rounded-full bg-peach text-[#B23E12] dark:text-[#6FD394] text-[13px] font-medium"
                              >
                                {skill.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {activeAnalysis.technicalSkills?.length > 0 &&
                      !activeAnalysis.technicalSkills.some((s) =>
                        ['Expert', 'Intermediate', 'Beginner'].some((l) =>
                          s.proficiency?.includes(l)
                        )
                      ) && (
                        <div className="flex flex-wrap gap-2">
                          {activeAnalysis.technicalSkills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-full bg-peach text-[#B23E12] dark:text-[#6FD394] text-[13px] font-medium"
                            >
                              {skill.name || skill}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                </Card>

                {/* Soft Skills */}
                <Card variant="mint" padding="p-6 sm:p-7">
                  <div className="flex items-center gap-3 mb-5">
                    <IconBubble icon={FiUsers} tone="surface" />
                    <h3 className="font-display font-normal tracking-[-0.03em] text-lg text-text-primary">Soft skills</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeAnalysis.softSkills?.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-full bg-bg-surface/80 text-text-primary text-[13px] font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </Card>

                {/* ATS Keywords */}
                <Card variant="sky" padding="p-6 sm:p-7">
                  <div className="flex items-center gap-3 mb-5">
                    <IconBubble icon={FiHash} tone="surface" />
                    <h3 className="font-display font-normal tracking-[-0.03em] text-lg text-text-primary">ATS keywords</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeAnalysis.keywords?.map((keyword, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-full bg-bg-surface/80 text-text-primary text-[13px] font-mono tracking-[-0.01em]"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Priority Interview Topics with 1-Click Actions */}
              <Card padding="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
                  <div>
                    <Eyebrow index="02">Focus areas</Eyebrow>
                    <h3 className="font-display font-normal tracking-[-0.035em] text-2xl text-text-primary mt-2">
                      Priority interview <span className="serif italic text-[#1D9E4B]">topics</span>
                    </h3>
                  </div>
                  <p className="text-sm text-text-secondary max-w-sm">
                    Generate a <strong className="text-text-primary font-medium">study guide</strong>,{' '}
                    <strong className="text-text-primary font-medium">MCQ set</strong>, or{' '}
                    <strong className="text-text-primary font-medium">mock interview</strong> for any topic below.
                  </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {activeAnalysis.priorityTopics?.map((topic, idx) => {
                    const imp = topic.importance?.toLowerCase();
                    return (
                      <motion.div
                        key={idx}
                        whileHover={{ y: -4 }}
                        transition={SPRING}
                        className="p-5 sm:p-6 bg-bg-elevated rounded-[20px] flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="font-mono text-xs text-[#1D9E4B] mt-1.5 shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <h4 className="font-display font-normal tracking-[-0.02em] text-[17px] leading-snug text-text-primary">
                              {topic.topic}
                            </h4>
                          </div>
                          <Badge
                            variant={
                              imp === 'high' ? 'error' : imp === 'medium' ? 'warning' : 'success'
                            }
                            className="shrink-0 capitalize"
                          >
                            {topic.importance || 'Core'} Priority
                          </Badge>
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed mb-5 flex-1">
                          {topic.description}
                        </p>

                        {/* Unified Workflow Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={FiBookOpen}
                            onClick={() => {
                              setSelectedTopic(topic.topic);
                              setStudyModalOpen(true);
                            }}
                          >
                            Study guide
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={FiList}
                            onClick={() =>
                              navigate('/mcq-generator', {
                                state: { jobRole: activeAnalysis.jobRole, skills: topic.topic },
                              })
                            }
                          >
                            Practice MCQs
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            icon={FiVideo}
                            onClick={() =>
                              navigate('/mock-interview', {
                                state: { jobRole: `${activeAnalysis.jobRole} (${topic.topic})` },
                              })
                            }
                          >
                            Mock interview
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>

              {/* Multi-Week Preparation Roadmap — numbered timeline */}
              {activeAnalysis.roadmap && typeof activeAnalysis.roadmap === 'object' && (
                <Card padding="p-6 sm:p-8">
                  <div className="flex items-center gap-3.5 mb-8">
                    <IconBubble icon={FiMap} tone="lilac" />
                    <div>
                      <Eyebrow index="03">Roadmap</Eyebrow>
                      <h3 className="font-display font-normal tracking-[-0.035em] text-2xl text-text-primary mt-2">
                        Week-by-week <span className="serif italic text-[#1D9E4B]">preparation</span>
                      </h3>
                    </div>
                  </div>

                  <ol className="relative">
                    {Object.entries(activeAnalysis.roadmap).map(([week, topics], idx, arr) => {
                      const isOpen = expandedWeek === week;
                      const isLast = idx === arr.length - 1;
                      return (
                        <li key={idx} className="relative flex gap-4 sm:gap-5">
                          {/* Timeline rail */}
                          <div className="flex flex-col items-center shrink-0">
                            <span
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-xs font-medium transition-colors duration-300 ${
                                isOpen
                                  ? 'bg-[#1D9E4B] text-white shadow-[0_8px_20px_-8px_rgba(29,158,75,0.7)]'
                                  : 'bg-bg-surface border border-border-subtle text-text-primary'
                              }`}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            {!isLast && <span className="w-px flex-1 bg-border-subtle my-1.5" />}
                          </div>

                          <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-6'}`}>
                            <button
                              type="button"
                              className="w-full flex justify-between items-center gap-3 rounded-[18px] px-4 py-2.5 -mx-1 hover:bg-surface-hover transition-colors cursor-pointer text-left"
                              onClick={() => setExpandedWeek(expandedWeek === week ? null : week)}
                            >
                              <div className="min-w-0">
                                <span className="eyebrow">Week {idx + 1}</span>
                                <h4 className="font-display font-normal tracking-[-0.02em] text-[17px] text-text-primary capitalize mt-1.5 truncate">
                                  {week.replace(/([A-Z])/g, ' $1').trim()}
                                </h4>
                              </div>
                              <FiChevronDown
                                className={`shrink-0 text-text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                              />
                            </button>
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                  className="overflow-hidden"
                                >
                                  <ul className="mt-3 space-y-2.5 rounded-[18px] bg-bg-elevated p-4 sm:p-5">
                                    {Array.isArray(topics) ? (
                                      topics.map((topic, tIdx) => (
                                        <li
                                          key={tIdx}
                                          className="flex items-start gap-2.5 text-sm text-text-secondary leading-relaxed"
                                        >
                                          <FiCheckCircle className="text-success mt-0.5 flex-shrink-0" />
                                          <span>{topic}</span>
                                        </li>
                                      ))
                                    ) : (
                                      <li className="text-sm text-text-secondary">{String(topics)}</li>
                                    )}
                                  </ul>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Card>
              )}
            </div>
          ) : (
            <Card padding="p-6 sm:p-8" className="rounded-[28px] min-h-[520px]">
              <div className="flex flex-wrap items-end justify-between gap-3 pb-6 mb-6 border-b border-border-subtle">
                <div>
                  <Eyebrow index="02">Archive</Eyebrow>
                  <h3 className="font-display font-normal tracking-[-0.035em] text-2xl text-text-primary mt-2">
                    Decoded job analyses
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    Select any saved role breakdown to view its skills &amp; prep roadmap
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-bg-elevated font-mono text-xs text-text-secondary">
                  {pastAnalyses?.data?.length || 0} Saved
                </span>
              </div>

              {isPastLoading ? (
                <div className="py-20 flex justify-center items-center">
                  <Loader />
                </div>
              ) : pastAnalyses?.data?.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-[620px] overflow-y-auto pr-1 -mr-1 pb-1">
                  {pastAnalyses.data.map((analysis) => (
                    <motion.div
                      key={analysis._id}
                      whileHover={{ y: -4 }}
                      transition={SPRING}
                      className="group p-5 rounded-[20px] border border-border-subtle bg-bg-surface hover:shadow-md hover:border-[#1D9E4B]/30 cursor-pointer transition-[box-shadow,border-color] duration-300"
                      onClick={() => setActiveAnalysis(analysis)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <h4 className="font-display font-normal tracking-[-0.02em] text-[17px] text-text-primary truncate">
                            {analysis.jobRole}
                          </h4>
                          <span className="text-xs text-text-muted">
                            {analysis.experienceLevel} · {new Date(analysis.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center text-text-secondary group-hover:bg-[#1D9E4B] group-hover:text-white transition-colors shrink-0">
                          <FiArrowUpRight className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {analysis.technicalSkills?.slice(0, 4).map((skill, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated text-text-secondary"
                          >
                            {skill.name || skill}
                          </span>
                        ))}
                        {analysis.technicalSkills?.length > 4 && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-peach text-[#167A3A] dark:text-[#6FD394]">
                            +{analysis.technicalSkills.length - 4} more
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-[24px] bg-bg-elevated flex flex-col justify-center items-center text-center py-16 px-6">
                  <Aura intensity={0.4} />
                  <div className="relative flex flex-col items-center">
                    <EvalixOrb size="md" state="idle" />
                    <p className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary mt-5">
                      No job descriptions analyzed yet
                    </p>
                    <p className="text-sm text-text-secondary mt-1.5 max-w-xs">
                      Paste a job listing to extract technical requirements and generate a custom roadmap.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Study Material Modal */}
      {studyModalOpen && activeAnalysis && (
        <StudyMaterialModal
          isOpen={studyModalOpen}
          onClose={() => setStudyModalOpen(false)}
          topic={selectedTopic}
          jobRole={activeAnalysis.jobRole}
        />
      )}
    </div>
  );
};

export default JobAnalysis;
