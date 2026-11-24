import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiList, FiClock, FiPlay, FiCheckCircle,
  FiChevronDown, FiXCircle, FiX, FiZap,
} from 'react-icons/fi';
import { useApiMutation, useApiQuery } from '../hooks/useApi';
import { API } from '../api/endpoints';
import { DIFFICULTY_LEVELS, MCQ_COUNTS } from '../utils/constants';
import SEOHead from '../components/common/SEOHead';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import api from '../api/axios';
import EvalixOrb from '../components/ui/EvalixOrb';
import { PageHeader, Eyebrow, Reveal, Aura } from '@/components/studio';

const SPRING = { type: 'spring', stiffness: 300, damping: 26 };

const MCQGenerator = () => {
  const location = useLocation();
  const [jobRole, setJobRole] = useState(location.state?.jobRole || '');
  const [skills, setSkills] = useState(location.state?.skills || '');
  const [count, setCount] = useState('20');
  const [difficulty, setDifficulty] = useState('medium');
  const [activeMCQSet, setActiveMCQSet] = useState(null);
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [userSelections, setUserSelections] = useState({});

  const navigate = useNavigate();

  // Fetch past MCQ sets
  const { data: pastSets, isLoading: isPastLoading } = useApiQuery('mcqSets', API.MCQ.LIST);

  // Generate mutation
  const generateMutation = useApiMutation(API.MCQ.GENERATE, 'post', {
    successMessage: 'MCQs generated!',
    invalidateQueries: ['mcqSets'],
    onSuccess: (data) => {
      setActiveMCQSet(data.data);
      setRevealedAnswers({});
      setUserSelections({});
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
      count: Number(count),
      difficulty,
    });
  };

  const toggleAnswer = (index) => {
    setRevealedAnswers((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const startAssessment = () => {
    if (activeMCQSet?._id) {
      navigate(`/assessment/${activeMCQSet._id}`);
    }
  };

  const viewSavedSet = async (id) => {
    try {
      const { data } = await api.get(API.MCQ.GET(id));
      setActiveMCQSet(data.data);
      setRevealedAnswers({});
      setUserSelections({});
    } catch (err) {
      console.error(err);
    }
  };

  const difficultyVariant = (d) => (d === 'hard' ? 'error' : d === 'medium' ? 'warning' : 'success');

  return (
    <div className="pb-12">
      <SEOHead title="Technical MCQ Drills & Assessments — Evalix" />

      <PageHeader
        eyebrow="Prep lab · MCQ drills"
        title="Sharpen recall with"
        accent="technical drills"
        description={
          <>
            Generate custom <strong className="text-text-primary font-medium">10 to 30 multiple-choice questions</strong> by role and
            topic. Practice interactively with explanations or start a{' '}
            <strong className="text-text-primary font-medium">timed assessment (90s per question)</strong>.
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Generator Form & Saved Sets */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 min-w-0">
          <Reveal>
            <Card padding="p-6 sm:p-8" className="rounded-[28px]">
              <div className="flex items-center gap-3.5 mb-7">
                <span className="w-10 h-10 rounded-full bg-peach text-[#167A3A] dark:text-[#6FD394] flex items-center justify-center shrink-0">
                  <FiZap className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0">
                  <Eyebrow index="01">Configure</Eyebrow>
                  <h2 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary mt-1.5">
                    Build a drill set
                  </h2>
                </div>
              </div>

              <form onSubmit={handleGenerate} className="space-y-5">
                <Input
                  id="jobRole"
                  label="Target Role"
                  placeholder="e.g., Frontend Engineer"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  required
                />

                <Input
                  id="skills"
                  label="Skills / Topics (comma separated)"
                  placeholder="React, TypeScript, State Management, CSS"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    id="count"
                    label="Question Count"
                    options={MCQ_COUNTS}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    required
                  />

                  <Select
                    id="difficulty"
                    label="Difficulty"
                    options={DIFFICULTY_LEVELS}
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
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
                  Generate MCQ set
                </Button>
              </form>
            </Card>
          </Reveal>

          {/* Saved Sets Archive */}
          <Reveal delay={0.08}>
            <Card padding="p-6 sm:p-7" className="rounded-[28px]">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-subtle">
                <h3 className="font-display font-normal tracking-[-0.03em] text-lg text-text-primary">
                  Recent MCQ sets
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
                    const isActive = activeMCQSet?._id === set._id;
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
                          <h4 className="font-medium text-sm text-text-primary truncate">{set.jobRole}</h4>
                          <span className="text-[11px] font-mono text-text-muted flex-shrink-0">
                            {new Date(set.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-bg-surface/80 text-text-secondary">
                            {set.count} Qs
                          </span>
                          <Badge variant={difficultyVariant(set.difficulty)} className="capitalize">
                            {set.difficulty}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center py-6">No saved MCQ sets yet.</p>
              )}
            </Card>
          </Reveal>
        </div>

        {/* Right Column: Active MCQ Drill View */}
        <div className="lg:col-span-7 xl:col-span-8 min-w-0">
          {generateMutation.isPending ? (
            <div className="relative overflow-hidden rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-10 sm:p-14 flex flex-col items-center justify-center min-h-[520px] text-center">
              <Aura intensity={0.55} />
              <div className="relative flex flex-col items-center">
                <EvalixOrb size="lg" state="thinking" />
                <Eyebrow dot className="mt-7">Generating</Eyebrow>
                <h3 className="font-display font-normal tracking-[-0.035em] text-2xl sm:text-3xl text-text-primary mt-3 text-balance">
                  Generating {count} {difficulty} MCQs for <span className="serif italic text-[#1D9E4B]">{jobRole}</span>…
                </h3>
                <p className="text-sm sm:text-[15px] text-text-secondary mt-3 max-w-md leading-relaxed">
                  Writing multiple-choice questions with 4 options and answer explanations.
                </p>
              </div>
            </div>
          ) : activeMCQSet ? (
            <div className="space-y-5 animate-fade-in">
              {/* Sticky Action Banner */}
              <div className="glass shadow-md rounded-[24px] p-4 sm:p-5 pl-5 sm:pl-6 flex flex-wrap items-center justify-between gap-4 sticky top-20 z-20">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-full bg-mint text-[#2F6B12] dark:text-[#A8E07E] text-[11px] font-medium">
                      {activeMCQSet.questions.length} Questions
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-bg-elevated text-text-secondary text-[11px] font-medium capitalize">
                      {activeMCQSet.difficulty}
                    </span>
                  </div>
                  <h2 className="font-display font-normal tracking-[-0.035em] text-xl sm:text-2xl text-text-primary truncate">
                    {activeMCQSet.jobRole}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" icon={FiX} onClick={() => setActiveMCQSet(null)}>
                    Close set
                  </Button>
                  <Button variant="primary" size="sm" icon={FiPlay} onClick={startAssessment}>
                    Start timed assessment
                  </Button>
                </div>
              </div>

              {/* Interactive Questions List */}
              <div className="space-y-5">
                {activeMCQSet.questions.map((q, qIndex) => {
                  const isRevealed = Boolean(revealedAnswers[qIndex]);
                  const selectedIdx = userSelections[qIndex];

                  return (
                    <Card key={qIndex} padding="p-5 sm:p-7">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-5">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <span className="px-2.5 py-1 rounded-full bg-peach text-[#167A3A] dark:text-[#6FD394] font-mono text-[11px] font-medium flex-shrink-0 mt-0.5">
                            Q{String(qIndex + 1).padStart(2, '0')}
                          </span>
                          <h3 className="font-display font-normal tracking-[-0.02em] text-base sm:text-lg text-text-primary leading-snug">
                            {q.question}
                          </h3>
                        </div>
                        <Badge variant="default" className="self-start shrink-0">
                          {q.topic || 'Core Concept'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 mb-5">
                        {q.options.map((opt, oIndex) => {
                          const isCorrect = oIndex === q.correctAnswer;
                          const isSelected = selectedIdx === oIndex;

                          let optClass =
                            'p-3.5 sm:p-4 rounded-[16px] border transition-all duration-300 text-sm w-full text-left flex justify-between items-center gap-3 cursor-pointer ';
                          let letterClass = 'bg-bg-surface border border-border-subtle text-text-secondary';

                          if (isRevealed) {
                            if (isCorrect) {
                              optClass += 'border-success/30 bg-success-bg text-text-primary font-medium';
                              letterClass = 'bg-success text-white border border-transparent';
                            } else if (isSelected && !isCorrect) {
                              optClass += 'border-danger/30 bg-danger-bg text-danger font-medium';
                              letterClass = 'bg-danger text-white border border-transparent';
                            } else {
                              optClass += 'border-transparent bg-bg-elevated opacity-60 text-text-secondary';
                            }
                          } else if (isSelected) {
                            optClass += 'border-[#1D9E4B]/40 bg-peach text-text-primary font-medium';
                            letterClass = 'bg-[#1D9E4B] text-white border border-transparent';
                          } else {
                            optClass +=
                              'border-transparent bg-bg-elevated hover:bg-surface-hover hover:border-border-subtle text-text-secondary hover:text-text-primary';
                          }

                          return (
                            <motion.button
                              key={oIndex}
                              type="button"
                              whileHover={!isRevealed ? { x: 2 } : {}}
                              transition={SPRING}
                              onClick={() => {
                                setUserSelections((prev) => ({ ...prev, [qIndex]: oIndex }));
                                setRevealedAnswers((prev) => ({ ...prev, [qIndex]: true }));
                              }}
                              className={optClass}
                            >
                              <span className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`w-7 h-7 rounded-full font-mono text-[11px] font-medium flex items-center justify-center flex-shrink-0 ${letterClass}`}
                                >
                                  {String.fromCharCode(65 + oIndex)}
                                </span>
                                <span className="leading-relaxed">{opt}</span>
                              </span>
                              {isRevealed && isCorrect && (
                                <FiCheckCircle size={18} className="text-success shrink-0" />
                              )}
                              {isRevealed && isSelected && !isCorrect && (
                                <FiXCircle size={18} className="text-danger shrink-0" />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>

                      <div className="pt-4 border-t border-border-subtle">
                        <button
                          type="button"
                          className="text-[13px] font-medium text-[#1D9E4B] hover:text-[#167A3A] flex items-center gap-1.5 cursor-pointer transition-colors"
                          onClick={() => toggleAnswer(qIndex)}
                        >
                          <FiChevronDown
                            className={`transition-transform duration-300 ${isRevealed ? 'rotate-180' : ''}`}
                          />
                          {isRevealed ? 'Hide explanation' : 'Reveal answer & explanation'}
                        </button>

                        <AnimatePresence initial={false}>
                          {isRevealed && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 p-4 sm:p-5 rounded-[18px] bg-mint">
                                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#2F6B12] dark:text-[#A8E07E]">
                                  Correct Option: {String.fromCharCode(65 + q.correctAnswer)}
                                </p>
                                <p className="text-sm text-text-primary/80 mt-2 leading-relaxed">{q.explanation}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-10 sm:p-14 min-h-[520px] flex flex-col justify-center items-center text-center">
              <Aura intensity={0.45} />
              <div className="relative flex flex-col items-center">
                <EvalixOrb size="lg" state="idle" />
                <Eyebrow dot className="mt-7">Interactive concept drills</Eyebrow>
                <h3 className="font-display font-normal tracking-[-0.035em] text-2xl sm:text-3xl text-text-primary mt-3 text-balance">
                  Sharpen your technical <span className="serif italic text-[#1D9E4B]">recall</span>
                </h3>
                <p className="text-sm sm:text-[15px] text-text-secondary mt-3 max-w-md leading-relaxed">
                  Configure your target role and comma-separated skills to generate a custom MCQ set, or click any saved set to
                  practice immediately.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-peach text-[#167A3A] dark:text-[#6FD394] text-xs font-medium">
                    <FiList /> 4 options each
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mint text-[#2F6B12] dark:text-[#A8E07E] text-xs font-medium">
                    <FiCheckCircle /> Instant explanations
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-lilac text-[#1D6FB8] dark:text-[#8EC1FF] text-xs font-medium">
                    <FiClock /> 90s timed mode
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

export default MCQGenerator;
