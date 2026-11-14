import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiBriefcase, FiFileText, FiChevronDown, FiChevronUp,
  FiCheckCircle, FiBookOpen, FiList, FiVideo, FiCpu,
  FiTarget, FiMap, FiLayers, FiRotateCcw,
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
import EvalixOrb, { EvalixStarburst } from '../components/ui/EvalixOrb';

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
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {generateMutation.isPending ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <EvalixOrb size="md" state="thinking" />
            <p className="mt-4 font-display font-bold text-text-primary">
              Compiling Deep-Dive Study Guide...
            </p>
            <p className="text-xs text-text-secondary mt-1">
              Synthesizing key concepts, interview talking points, and practical examples for {topic}.
            </p>
          </div>
        ) : content ? (
          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-text-primary">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-[#EF4444] text-sm font-medium">
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
    <div className="space-y-6 pb-10">
      <SEOHead title="Job & JD Decoder — Evalix Prep Lab" />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <h1 className="heading-page text-text-primary">Job Description Analyzer</h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1">
            Paste a job posting to extract <strong className="text-text-primary font-semibold">technical skills</strong>, <strong className="text-text-primary font-semibold">ATS keywords</strong>, and a <strong className="text-text-primary font-semibold">week-by-week study roadmap</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6 border border-border-subtle">
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
                Analyze Job Description
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Active Analysis or Recent Archive (8 cols) */}
        <div className="lg:col-span-8">
          {analyzeMutation.isPending ? (
            <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-12 flex flex-col items-center justify-center min-h-[500px] text-center">
              <EvalixOrb size="lg" state="thinking" />
              <h3 className="heading-card text-[#F8F5EF] mt-5">
                Analyzing {jobRole} Requirements...
              </h3>
              <p className="text-sm text-[#F8F5EF]/65 mt-2 max-w-md">
                Extracting required technical skills, priority interview topics, and a week-by-week preparation schedule.
              </p>
            </div>
          ) : activeAnalysis ? (
            <div className="space-y-6 animate-fade-in">
              {/* Header Banner */}
              <div className="rounded-[22px] bg-[#151515] text-[#F8F5EF] p-6 sm:p-8 border border-[#2E2E2E]">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#C7F36B] text-[#151515] font-mono text-xs font-bold uppercase">
                        {activeAnalysis.experienceLevel}
                      </span>
                      <span className="text-xs font-mono text-[#F8F5EF]/70">
                        <strong className="text-white">{activeAnalysis.technicalSkills?.length || 0}</strong> Technical Skills Identified
                      </span>
                    </div>
                    <h2 className="heading-section text-[#F8F5EF]">{activeAnalysis.jobRole}</h2>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={FiRotateCcw}
                    onClick={() => setActiveAnalysis(null)}
                  >
                    All Analyses
                  </Button>
                </div>
              </div>

              {/* Skills & Keywords Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Technical Skills */}
                <Card className="p-6 border border-border-subtle">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="heading-card text-text-primary">Technical Stack</h3>
                  </div>

                  <div className="space-y-4">
                    {['Expert', 'Intermediate', 'Beginner'].map((level) => {
                      const skills =
                        activeAnalysis.technicalSkills?.filter(
                          (s) => s.proficiency?.includes(level) || s.proficiency === level
                        ) || [];
                      if (skills.length === 0) return null;

                      return (
                        <div key={level}>
                          <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted mb-2">
                            {level} Proficiency
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {skills.map((skill, idx) => (
                              <Badge key={idx} variant="primary">
                                {skill.name}
                              </Badge>
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
                        <div className="flex flex-wrap gap-1.5">
                          {activeAnalysis.technicalSkills.map((skill, idx) => (
                            <Badge key={idx} variant="primary">
                              {skill.name || skill}
                            </Badge>
                          ))}
                        </div>
                      )}
                  </div>
                </Card>

                {/* Soft Skills & ATS Keywords */}
                <div className="space-y-6">
                  <Card className="p-6 border border-border-subtle">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="heading-card text-text-primary">Soft Skills</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeAnalysis.softSkills?.map((skill, idx) => (
                        <Badge key={idx} variant="purple">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-6 border border-border-subtle">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="heading-card text-text-primary">ATS Keywords</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeAnalysis.keywords?.map((keyword, idx) => (
                        <Badge key={idx} variant="default">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>

              {/* Priority Interview Topics with 1-Click Actions */}
              <Card className="p-6 border border-border-subtle">
                <div className="mb-4">
                  <h3 className="heading-card text-text-primary">Priority Interview Topics</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Generate a <strong className="text-text-primary font-semibold">study guide</strong>, <strong className="text-text-primary font-semibold">MCQ set</strong>, or <strong className="text-text-primary font-semibold">mock interview</strong> for any topic below.
                  </p>
                </div>

                <div className="space-y-3">
                  {activeAnalysis.priorityTopics?.map((topic, idx) => {
                    const imp = topic.importance?.toLowerCase();
                    return (
                      <div
                        key={idx}
                        className="p-4 bg-bg-canvas rounded-[14px] border border-border-subtle"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <h4 className="font-display font-bold text-base text-text-primary">
                            {idx + 1}. {topic.topic}
                          </h4>
                          <Badge
                            variant={
                              imp === 'high' ? 'danger' : imp === 'medium' ? 'warning' : 'success'
                            }
                          >
                            {topic.importance || 'Core'} Priority
                          </Badge>
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed mb-4">
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
                            Study Guide
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
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
                            Mock Interview
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Multi-Week Preparation Roadmap */}
              {activeAnalysis.roadmap && typeof activeAnalysis.roadmap === 'object' && (
                <Card className="p-6 border border-border-subtle">
                  <div className="mb-5">
                    <h3 className="heading-card text-text-primary">Week-by-Week Preparation Roadmap</h3>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(activeAnalysis.roadmap).map(([week, topics], idx) => (
                      <div
                        key={idx}
                        className="border border-border-subtle rounded-[14px] overflow-hidden bg-bg-canvas"
                      >
                        <button
                          type="button"
                          className="w-full flex justify-between items-center p-4 hover:bg-surface-hover transition-colors cursor-pointer text-left"
                          onClick={() => setExpandedWeek(expandedWeek === week ? null : week)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded-[8px] bg-[#151515] text-[#C7F36B] font-mono text-xs font-bold">
                              Week {idx + 1}
                            </span>
                            <h4 className="font-display font-bold text-text-primary capitalize">
                              {week.replace(/([A-Z])/g, ' $1').trim()}
                            </h4>
                          </div>
                          {expandedWeek === week ? <FiChevronUp /> : <FiChevronDown />}
                        </button>
                        <AnimatePresence>
                          {expandedWeek === week && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-bg-surface"
                            >
                              <div className="p-4 border-t border-border-subtle">
                                <ul className="space-y-2">
                                  {Array.isArray(topics) ? (
                                    topics.map((topic, tIdx) => (
                                      <li
                                        key={tIdx}
                                        className="flex items-start gap-2.5 text-sm text-text-secondary"
                                      >
                                        <FiCheckCircle className="text-emerald-600 dark:text-[#C7F36B] mt-0.5 flex-shrink-0" />
                                        <span>{topic}</span>
                                      </li>
                                    ))
                                  ) : (
                                    <li className="text-sm text-text-secondary">
                                      {String(topics)}
                                    </li>
                                  )}
                                </ul>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <Card className="p-6 border-2 border-border-subtle min-h-[500px] flex flex-col">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-border-subtle">
                <div>
                  <h3 className="heading-card text-text-primary">Decoded Job Analyses</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Select any saved role breakdown to view its skills &amp; prep roadmap
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-bg-canvas border border-border-subtle font-mono text-xs text-text-secondary">
                  {pastAnalyses?.data?.length || 0} Saved
                </span>
              </div>

              {isPastLoading ? (
                <div className="flex-1 flex justify-center items-center">
                  <Loader />
                </div>
              ) : pastAnalyses?.data?.length > 0 ? (
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[520px] pr-1">
                  {pastAnalyses.data.map((analysis) => (
                    <div
                      key={analysis._id}
                      className="p-4 rounded-[14px] border-2 border-border-subtle bg-bg-canvas hover:border-[#151515] dark:hover:border-[#FF6B35] cursor-pointer transition-all"
                      onClick={() => setActiveAnalysis(analysis)}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <h4 className="font-display font-bold text-base text-text-primary">
                            {analysis.jobRole}
                          </h4>
                          <span className="text-xs font-mono text-text-muted">
                            {analysis.experienceLevel}
                          </span>
                        </div>
                        <Badge variant="default">
                          {new Date(analysis.createdAt).toLocaleDateString()}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {analysis.technicalSkills?.slice(0, 4).map((skill, idx) => (
                          <span
                            key={idx}
                            className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-bg-surface border border-border-subtle text-text-secondary"
                          >
                            {skill.name || skill}
                          </span>
                        ))}
                        {analysis.technicalSkills?.length > 4 && (
                          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35]">
                            +{analysis.technicalSkills.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center py-12">
                  <EvalixOrb size="md" state="idle" />
                  <p className="font-display font-bold text-base text-text-primary mt-4">
                    No job descriptions analyzed yet
                  </p>
                  <p className="text-xs text-text-secondary mt-1 max-w-xs">
                    Paste a job listing on the left to extract technical requirements and generate a custom roadmap.
                  </p>
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
