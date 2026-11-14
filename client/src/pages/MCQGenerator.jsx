import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiList, FiClock, FiPlay, FiCheckCircle,
  FiChevronDown, FiChevronUp, FiCpu, FiXCircle,
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

  return (
    <div className="space-y-6 pb-10">
      <SEOHead title="Technical MCQ Drills & Assessments — Evalix" />

      {/* Header */}
      <div className="border-b border-border-subtle pb-5">
        <h1 className="heading-page text-text-primary">Technical MCQ Generator</h1>
        <p className="text-sm sm:text-base text-text-secondary mt-1">
          Generate custom <strong className="text-text-primary font-semibold">10 to 30 multiple-choice questions</strong> by role and topic. Practice interactively with explanations or start a <strong className="text-text-primary font-semibold">timed assessment (90s per question)</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Generator Form & Saved Sets (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6 border border-border-subtle">
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
                Generate MCQ Set
              </Button>
            </form>
          </Card>

          {/* Saved Sets Archive */}
          <Card className="p-6 border border-border-subtle">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
              <h3 className="font-display font-bold text-base text-text-primary">
                Recent MCQ Sets
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
                      activeMCQSet?._id === set._id
                        ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                        : 'border-border-subtle bg-bg-canvas hover:border-text-primary'
                    }`}
                    onClick={() => viewSavedSet(set._id)}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h4 className="font-display font-bold text-sm text-text-primary truncate">
                        {set.jobRole}
                      </h4>
                      <span className="text-[11px] font-mono text-text-muted flex-shrink-0">
                        {new Date(set.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{set.count} Qs</Badge>
                      <Badge
                        variant={
                          set.difficulty === 'hard'
                            ? 'danger'
                            : set.difficulty === 'medium'
                            ? 'warning'
                            : 'success'
                        }
                      >
                        {set.difficulty}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted text-center py-6">
                No saved MCQ sets yet.
              </p>
            )}
          </Card>
        </div>

        {/* Right Column: Active MCQ Drill View (8 cols) */}
        <div className="lg:col-span-8">
          {generateMutation.isPending ? (
            <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-12 flex flex-col items-center justify-center min-h-[500px] text-center">
              <EvalixOrb size="lg" state="thinking" />
              <h3 className="heading-card text-[#F8F5EF] mt-5">
                Generating {count} {difficulty} MCQs for {jobRole}...
              </h3>
              <p className="text-sm text-[#F8F5EF]/65 mt-2 max-w-md">
                Writing multiple-choice questions with 4 options and answer explanations.
              </p>
            </div>
          ) : activeMCQSet ? (
            <div className="space-y-6 animate-fade-in">
              {/* Sticky Action Banner */}
              <div className="rounded-[20px] bg-[#151515] text-[#F8F5EF] p-5 border border-[#2E2E2E] flex flex-wrap items-center justify-between gap-4 sticky top-20 z-20">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#C7F36B] text-[#151515] font-mono text-xs font-bold uppercase">
                      {activeMCQSet.questions.length} Questions
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#282828] text-[#F8F5EF] font-mono text-xs uppercase">
                      {activeMCQSet.difficulty}
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-xl text-[#F8F5EF]">
                    {activeMCQSet.jobRole}
                  </h2>
                </div>
                <div className="flex items-center gap-2.5">
                  <Button variant="secondary" size="sm" onClick={() => setActiveMCQSet(null)}>
                    Close Set
                  </Button>
                  <Button variant="primary" size="sm" icon={FiPlay} onClick={startAssessment}>
                    Start Timed Assessment
                  </Button>
                </div>
              </div>

              {/* Interactive Questions List */}
              <div className="space-y-5">
                {activeMCQSet.questions.map((q, qIndex) => {
                  const isRevealed = Boolean(revealedAnswers[qIndex]);
                  const selectedIdx = userSelections[qIndex];

                  return (
                    <Card key={qIndex} className="p-6 border-2 border-border-subtle">
                      <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                        <div className="flex items-start gap-3">
                          <span className="px-2.5 py-1 rounded-[8px] bg-[#151515] text-[#F8F5EF] font-mono text-xs font-bold flex-shrink-0 mt-0.5">
                            Q{String(qIndex + 1).padStart(2, '0')}
                          </span>
                          <h3 className="font-display font-bold text-base sm:text-lg text-text-primary leading-snug">
                            {q.question}
                          </h3>
                        </div>
                        <Badge variant="default">{q.topic || 'Core Concept'}</Badge>
                      </div>

                      <div className="space-y-2.5 mb-4">
                        {q.options.map((opt, oIndex) => {
                          const isCorrect = oIndex === q.correctAnswer;
                          const isSelected = selectedIdx === oIndex;

                          let optClass =
                            'p-3.5 rounded-[12px] border-2 transition-all text-sm w-full text-left flex justify-between items-center cursor-pointer ';

                          if (isRevealed) {
                            if (isCorrect) {
                              optClass +=
                                'border-emerald-600 bg-emerald-500/15 text-text-primary font-semibold';
                            } else if (isSelected && !isCorrect) {
                              optClass +=
                                'border-[#EF4444] bg-[#EF4444]/15 text-[#EF4444] font-medium';
                            } else {
                              optClass +=
                                'border-border-subtle bg-bg-canvas opacity-60 text-text-secondary';
                            }
                          } else if (isSelected) {
                            optClass +=
                              'border-[#151515] dark:border-[#FF6B35] bg-[#FF6B35]/15 text-text-primary font-semibold shadow-[0_2px_0_0_#151515]';
                          } else {
                            optClass +=
                              'border-border-subtle bg-bg-canvas hover:border-text-primary text-text-secondary hover:text-text-primary';
                          }

                          return (
                            <button
                              key={oIndex}
                              type="button"
                              onClick={() => {
                                setUserSelections((prev) => ({ ...prev, [qIndex]: oIndex }));
                                setRevealedAnswers((prev) => ({ ...prev, [qIndex]: true }));
                              }}
                              className={optClass}
                            >
                              <span className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-[6px] bg-bg-surface border border-border-subtle font-mono text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {String.fromCharCode(65 + oIndex)}
                                </span>
                                <span>{opt}</span>
                              </span>
                              {isRevealed && isCorrect && (
                                <FiCheckCircle
                                  size={18}
                                  className="text-emerald-600 dark:text-[#C7F36B] shrink-0"
                                />
                              )}
                              {isRevealed && isSelected && !isCorrect && (
                                <FiXCircle size={18} className="text-[#EF4444] shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-3 border-t border-border-subtle">
                        <button
                          type="button"
                          className="text-xs font-mono uppercase tracking-wider font-semibold text-[#FF6B35] hover:underline flex items-center gap-1 cursor-pointer"
                          onClick={() => toggleAnswer(qIndex)}
                        >
                          {isRevealed ? (
                            <>
                              <FiChevronUp /> Hide Explanation
                            </>
                          ) : (
                            <>
                              <FiChevronDown /> Reveal Answer &amp; Explanation
                            </>
                          )}
                        </button>

                        <AnimatePresence>
                          {isRevealed && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden mt-3"
                            >
                              <div className="p-4 rounded-[12px] bg-bg-canvas border border-border-subtle">
                                <p className="text-xs font-mono uppercase tracking-wider text-emerald-600 dark:text-[#C7F36B] font-bold">
                                  Correct Option: {String.fromCharCode(65 + q.correctAnswer)}
                                </p>
                                <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">
                                  {q.explanation}
                                </p>
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
            <Card className="p-10 border-2 border-border-subtle min-h-[500px] flex flex-col justify-center items-center text-center">
              <EvalixOrb size="lg" state="idle" />
              <span className="mt-5 px-3 py-1 rounded-full bg-bg-canvas border border-border-subtle font-mono text-xs uppercase tracking-wider text-text-secondary">
                Interactive Concept Drills
              </span>
              <h3 className="heading-card text-text-primary mt-3">
                Sharpen Your Technical Recall
              </h3>
              <p className="text-sm text-text-secondary mt-2 max-w-md">
                Configure your target role and comma-separated skills on the left to generate a custom MCQ set, or click any saved set to practice immediately.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default MCQGenerator;
