import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiClock, FiCheckCircle, FiXCircle, FiArrowRight,
  FiArrowLeft, FiFlag, FiAward, FiCpu, FiMinusCircle,
} from 'react-icons/fi';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { API } from '../api/endpoints';
import SEOHead from '../components/common/SEOHead';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import Modal from '../components/ui/Modal';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { formatTime } from '../utils/helpers';
import EvalixOrb from '../components/ui/EvalixOrb';
import { Eyebrow, Reveal, Aura, ScoreRing } from '@/components/studio';
import { Progress } from '@/components/shadcn/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/shadcn/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/shadcn/accordion';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shadcn/tooltip';
import { cn } from '@/lib/utils';

/* Compact countdown ring used inside the timer pill (visual only). */
const TimerRing = ({ pct, urgent }) => {
  const size = 22;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" className="opacity-20" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        stroke={urgent ? 'var(--danger)' : '#1D9E4B'}
        strokeDasharray={c}
        strokeDashoffset={c - clamped * c}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
};

const AssessmentTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Test State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTestStarted, setIsTestStarted] = useState(false);
  const [isTestFinished, setIsTestFinished] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState(null);

  // Fetch MCQ Set
  const { data: mcqSetData, isLoading, error } = useApiQuery(
    ['mcqSet', id],
    API.MCQ.GET(id),
    {
      enabled: !!id,
      showErrorToast: false,
    }
  );

  const mcqSet = mcqSetData?.data;

  // Submit Mutation
  const submitMutation = useApiMutation(API.ASSESSMENT.SUBMIT, 'post', {
    onSuccess: (data) => {
      setAssessmentResult(data.data);
      setIsTestFinished(true);
    },
  });

  // Timer Effect
  useEffect(() => {
    let timer;
    if (isTestStarted && !isTestFinished && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            autoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTestStarted, isTestFinished, timeLeft]);

  const handleStartTest = () => {
    if (!mcqSet || !mcqSet.questions) return;
    const totalSeconds = mcqSet.questions.length * 90;
    setTimeLeft(totalSeconds);
    setIsTestStarted(true);
  };

  const handleSelectOption = (qIndex, oIndex) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [qIndex]: oIndex,
    }));
  };

  const toggleMarkForReview = (qIndex) => {
    setMarkedForReview((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(qIndex)) {
        newSet.delete(qIndex);
      } else {
        newSet.add(qIndex);
      }
      return newSet;
    });
  };

  const autoSubmit = () => {
    submitTest();
  };

  const submitTest = () => {
    setShowSubmitModal(false);

    const answersArray = Object.keys(selectedAnswers).map((qIdx) => ({
      questionIndex: parseInt(qIdx, 10),
      selectedAnswer: selectedAnswers[qIdx],
    }));

    const totalTimeAssigned = mcqSet.questions.length * 90;
    const timeTaken = totalTimeAssigned - timeLeft;

    submitMutation.mutate({
      mcqSetId: id,
      answers: answersArray,
      timeTaken,
    });
  };


  // Error State
  if (error) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <EvalixOrb size="md" state="idle" />
        <h2 className="heading-page text-text-primary mt-6 mb-3">
          Assessment <span className="serif italic text-[#1D9E4B]">not found</span>
        </h2>
        <p className="text-[15px] text-text-secondary mb-8 max-w-sm">
          This MCQ set may have been removed or you don't have access.
        </p>
        <Button onClick={() => navigate('/mcq-generator')}>Back to MCQ Generator</Button>
      </div>
    );
  }

  // Loading State
  if (isLoading || !mcqSet) return <Loader fullScreen />;

  // Empty Data State
  if (!mcqSet.questions || mcqSet.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h2 className="heading-page text-text-primary mb-3">
          No questions <span className="serif italic text-[#1D9E4B]">available</span>
        </h2>
        <p className="text-[15px] text-text-secondary mb-8 max-w-sm">
          There was an error loading the questions for this assessment.
        </p>
        <Button onClick={() => navigate('/mcq-generator')}>Generate New Questions</Button>
      </div>
    );
  }

  // ── 1. Pre-Assessment Briefing Screen ─────────────────────────────────────
  if (!isTestStarted && !isTestFinished) {
    return (
      <div className="max-w-2xl mx-auto py-6 sm:py-10">
        <SEOHead title={`Timed Assessment: ${mcqSet.jobRole}`} />
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-bg-surface border border-border-subtle shadow-md p-7 sm:p-10 text-center">
            <Aura intensity={0.55} />
            <div className="relative">
              <div className="flex justify-center mb-6">
                <EvalixOrb size="md" state="idle" />
              </div>

              <Eyebrow dot className="justify-center">Timed assessment</Eyebrow>
              <h1 className="heading-page text-text-primary mt-4 mb-3 text-balance break-words">{mcqSet.jobRole}</h1>
              <div className="flex justify-center mb-9">
                <Badge variant="primary">Difficulty: {mcqSet.difficulty || 'Standard'}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 max-w-md mx-auto">
                <div className="bg-lilac p-5 rounded-[20px] text-left">
                  <p className="eyebrow">Questions</p>
                  <p className="font-display font-normal tracking-[-0.05em] text-5xl text-text-primary mt-3 leading-none">
                    {mcqSet.questions.length}
                  </p>
                </div>
                <div className="bg-peach p-5 rounded-[20px] text-left">
                  <p className="eyebrow">Time limit</p>
                  <p className="font-display font-normal tracking-[-0.05em] text-5xl text-text-primary mt-3 leading-none">
                    {Math.round(mcqSet.questions.length * 1.5)}
                    <span className="serif italic text-[#1D9E4B] text-4xl tracking-normal ml-0.5">m</span>
                  </p>
                </div>
              </div>

              <div className="glass p-5 sm:p-6 rounded-[20px] text-left mb-9 max-w-md mx-auto">
                <h4 className="eyebrow text-[#1D9E4B] mb-4">Assessment format</h4>
                <ul className="text-sm text-text-secondary space-y-3">
                  <li className="flex gap-3">
                    <FiClock className="w-4 h-4 mt-0.5 shrink-0 text-[#1D9E4B]" />
                    <span><strong className="font-medium text-text-primary">90 seconds per question</strong>; auto-submits when the timer reaches 00:00.</span>
                  </li>
                  <li className="flex gap-3">
                    <FiCpu className="w-4 h-4 mt-0.5 shrink-0 text-[#2496ED]" />
                    <span>Jump between questions using the right-hand <strong className="font-medium text-text-primary">Question Navigator</strong>.</span>
                  </li>
                  <li className="flex gap-3">
                    <FiFlag className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
                    <span>Flag uncertain items for review before submitting.</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 justify-center">
                <Button variant="secondary" size="lg" onClick={() => navigate('/mcq-generator')}>
                  Back to MCQ Sets
                </Button>
                <Button size="lg" variant="primary" onClick={handleStartTest} icon={FiArrowRight}>
                  Start Timed Assessment
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    );
  }

  // ── 2. Post-Assessment Scorecard Screen ───────────────────────────────────
  if (isTestFinished && assessmentResult) {
    const score = Math.round(assessmentResult.score || 0);
    const verdict = score >= 80 ? 'Strong Score' : score >= 60 ? 'Passing Score' : 'Needs Review';
    const verdictVariant = score >= 80 ? 'success' : score >= 60 ? 'primary' : 'error';
    const ringColor = score >= 80 ? '#1F8A4C' : score >= 60 ? '#1D9E4B' : '#D92D20';

    const reviewRows = mcqSet.questions.map((q, qIndex) => {
      const answerData = assessmentResult.answers.find(
        (a) => a.questionIndex === qIndex
      );
      return {
        q,
        qIndex,
        userAnswerIndex: answerData?.selectedAnswer,
        isCorrect: answerData?.isCorrect,
      };
    });
    const missedRows = reviewRows.filter((r) => !r.isCorrect);
    const correctRows = reviewRows.filter((r) => r.isCorrect);
    const defaultOpen = missedRows.map((r) => String(r.qIndex));

    const renderReviewList = (rows) => {
      if (rows.length === 0) {
        return (
          <div className="rounded-[20px] bg-bg-elevated p-8 text-center text-sm text-text-secondary">
            Nothing to show in this view.
          </div>
        );
      }
      return (
        <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-3">
          {rows.map(({ q, qIndex, userAnswerIndex, isCorrect }) => {
            const isUnanswered = userAnswerIndex === undefined;
            return (
              <AccordionItem
                key={qIndex}
                value={String(qIndex)}
                className="rounded-[20px] border border-border-subtle bg-bg-surface px-4 sm:px-5 shadow-xs last:border-b"
              >
                <AccordionTrigger className="py-4 sm:py-5 text-[15px] sm:text-base hover:no-underline hover:text-text-primary">
                  <span className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="mt-0.5 shrink-0">
                      {isCorrect ? (
                        <span className="w-7 h-7 rounded-full bg-success-bg text-success flex items-center justify-center">
                          <FiCheckCircle className="w-4 h-4" />
                        </span>
                      ) : isUnanswered ? (
                        <span className="w-7 h-7 rounded-full bg-bg-elevated text-text-muted flex items-center justify-center" title="Skipped">
                          <FiMinusCircle className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-danger-bg text-danger flex items-center justify-center">
                          <FiXCircle className="w-4 h-4" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="eyebrow">Q{String(qIndex + 1).padStart(2, '0')}</span>
                        <Badge variant="default">{q.topic || 'Core'}</Badge>
                        {isUnanswered && <Badge variant="default">Skipped</Badge>}
                      </span>
                      <span className="block font-display font-normal tracking-[-0.02em] text-text-primary leading-snug break-words">
                        {q.question}
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-5 space-y-2.5">
                  {q.options.map((opt, oIndex) => {
                    const isOptionCorrect = oIndex === q.correctAnswer;
                    const isOptionSelected = oIndex === userAnswerIndex;

                    let optClass =
                      'p-3.5 rounded-[16px] border text-sm flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 ';

                    if (isOptionCorrect) {
                      optClass +=
                        'border-[#5DAA3A]/25 bg-mint text-text-primary font-medium';
                    } else if (isOptionSelected && !isOptionCorrect) {
                      optClass +=
                        'border-danger/25 bg-danger-bg text-danger font-medium';
                    } else {
                      optClass += 'border-border-subtle bg-bg-surface text-text-secondary';
                    }

                    return (
                      <div key={oIndex} className={optClass}>
                        <span className="flex items-start gap-3 min-w-0">
                          <span className="font-mono text-xs mt-0.5 opacity-70 shrink-0">
                            {String.fromCharCode(65 + oIndex)}
                          </span>
                          <span className="break-words">{opt}</span>
                        </span>
                        <div className="flex gap-1.5 shrink-0">
                          {isOptionSelected && (
                            <Badge variant="secondary">Your Pick</Badge>
                          )}
                          {isOptionCorrect && (
                            <Badge variant="success">Correct</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-3 p-4 rounded-[16px] bg-peach">
                    <p className="eyebrow text-[#167A3A] mb-2">Concept explanation</p>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {q.explanation}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      );
    };

    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <SEOHead title={`Assessment Scorecard: ${assessmentResult.jobRole}`} />

        {/* Score Banner */}
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-bg-surface border border-border-subtle shadow-md p-6 sm:p-8 lg:p-10">
            <Aura intensity={0.5} />
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                <ScoreRing value={score} size={150} stroke={10} color={ringColor}>
                  <span className="font-display font-normal tracking-[-0.05em] text-5xl text-text-primary leading-none">
                    <AnimatedCounter value={score} />
                    <span className="text-2xl text-text-muted">%</span>
                  </span>
                </ScoreRing>
                <div className="space-y-3">
                  <Eyebrow dot>Final score</Eyebrow>
                  <h2 className="font-display font-normal tracking-[-0.04em] text-3xl sm:text-4xl text-text-primary leading-[1.05]">
                    {score >= 80 ? 'Sharp' : score >= 60 ? 'Solid' : 'Keep'}{' '}
                    <span className="serif italic text-[#1D9E4B]">
                      {score >= 80 ? 'work.' : score >= 60 ? 'footing.' : 'going.'}
                    </span>
                  </h2>
                  <Badge variant={verdictVariant}>
                    <FiAward className="w-3.5 h-3.5" /> {verdict}
                  </Badge>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 sm:p-5 rounded-[20px] bg-sky">
                  <span className="eyebrow block">Time taken</span>
                  <span className="font-display font-normal tracking-[-0.04em] text-2xl text-text-primary mt-3 block tabular-nums">
                    {formatTime(assessmentResult.timeTaken)}
                  </span>
                </div>
                <div className="p-4 sm:p-5 rounded-[20px] bg-lilac">
                  <span className="eyebrow block">Accuracy</span>
                  <span className="font-display font-normal tracking-[-0.04em] text-2xl text-[#1D6FB8] dark:text-[#8EC1FF] mt-3 block tabular-nums">
                    {assessmentResult.accuracy}%
                  </span>
                </div>
                <div className="p-4 sm:p-5 rounded-[20px] bg-mint">
                  <span className="eyebrow block">Correct</span>
                  <span className="font-display font-normal tracking-[-0.04em] text-2xl text-success mt-3 block tabular-nums">
                    {assessmentResult.correctAnswers}
                  </span>
                </div>
                <div className="p-4 sm:p-5 rounded-[20px] bg-danger-bg">
                  <span className="eyebrow block">Incorrect</span>
                  <span className="font-display font-normal tracking-[-0.04em] text-2xl text-danger mt-3 block tabular-nums">
                    {assessmentResult.incorrectAnswers}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Detailed Question Review */}
        <Reveal delay={0.08}>
          <Card padding="p-5 sm:p-8" className="rounded-[28px]">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 pb-6 mb-6 border-b border-border-subtle">
              <div className="space-y-2">
                <Eyebrow>Review</Eyebrow>
                <h3 className="font-display font-normal tracking-[-0.03em] text-2xl text-text-primary">
                  Answer key &amp; <span className="serif italic text-[#1D9E4B]">explanations</span>
                </h3>
                <p className="text-sm text-text-muted">
                  Inspect every prompt alongside your selection and the verified explanation
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>

            <Tabs defaultValue="all" className="gap-5">
              <TabsList className="w-full sm:w-fit">
                <TabsTrigger value="all">All <span className="text-text-muted tabular-nums">{reviewRows.length}</span></TabsTrigger>
                <TabsTrigger value="missed">Missed <span className="text-text-muted tabular-nums">{missedRows.length}</span></TabsTrigger>
                <TabsTrigger value="correct">Correct <span className="text-text-muted tabular-nums">{correctRows.length}</span></TabsTrigger>
              </TabsList>
              <TabsContent value="all">{renderReviewList(reviewRows)}</TabsContent>
              <TabsContent value="missed">{renderReviewList(missedRows)}</TabsContent>
              <TabsContent value="correct">{renderReviewList(correctRows)}</TabsContent>
            </Tabs>
          </Card>
        </Reveal>
      </div>
    );
  }

  // ── 3. Active Timed Assessment Runner ─────────────────────────────────────
  const currentQuestion = mcqSet.questions[currentQuestionIdx];
  const totalQuestions = mcqSet.questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const totalSecondsAssigned = totalQuestions * 90;
  const isUrgent = timeLeft < 60;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 min-h-[calc(100vh-8rem)] pb-8">
      <SEOHead title={`Assessment Arena: ${mcqSet.jobRole}`} />

      {/* Submit Confirmation Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Finalize & Submit Assessment?"
      >
        <div className="py-2 text-center space-y-6">
          <p className="text-sm text-text-secondary">
            Review your completion telemetry below before locking in your answers.
          </p>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-4 rounded-[18px] bg-mint">
              <div className="font-display font-normal tracking-[-0.04em] text-3xl text-success tabular-nums">
                {Object.keys(selectedAnswers).length}
              </div>
              <div className="eyebrow mt-2">Answered</div>
            </div>
            <div className="p-4 rounded-[18px] bg-warning-bg">
              <div className="font-display font-normal tracking-[-0.04em] text-3xl text-warning tabular-nums">
                {markedForReview.size}
              </div>
              <div className="eyebrow mt-2">Flagged</div>
            </div>
            <div className="p-4 rounded-[18px] bg-bg-elevated">
              <div className="font-display font-normal tracking-[-0.04em] text-3xl text-text-primary tabular-nums">
                {mcqSet.questions.length - Object.keys(selectedAnswers).length}
              </div>
              <div className="eyebrow mt-2">Remaining</div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="secondary" fullWidth onClick={() => setShowSubmitModal(false)}>
              Keep Working
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={submitTest}
              loading={submitMutation.isPending}
            >
              Submit &amp; Score
            </Button>
          </div>
        </div>
      </Modal>

      {/* Left/Center: Active Question Runner (8 cols) */}
      <div className="lg:col-span-8 flex flex-col justify-between rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm overflow-hidden">
        {/* Top Telemetry Bar */}
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-peach text-[#167A3A] font-mono text-xs font-medium tabular-nums">
                Q{String(currentQuestionIdx + 1).padStart(2, '0')}
                <span className="opacity-50">/</span>
                {String(mcqSet.questions.length).padStart(2, '0')}
              </span>
              {markedForReview.has(currentQuestionIdx) && (
                <span className="px-3 py-1.5 rounded-full bg-warning-bg text-warning font-mono text-xs flex items-center gap-1.5">
                  <FiFlag className="w-3 h-3" /> Flagged
                </span>
              )}
            </div>

            <div
              className={cn(
                'flex items-center gap-2.5 font-mono text-sm font-medium pl-1.5 pr-4 py-1.5 rounded-full border tabular-nums transition-colors',
                isUrgent
                  ? 'bg-danger-bg border-danger/25 text-danger animate-pulse'
                  : 'bg-bg-surface border-border-subtle text-text-primary shadow-xs'
              )}
              aria-label="Time remaining"
            >
              <TimerRing pct={totalSecondsAssigned ? timeLeft / totalSecondsAssigned : 0} urgent={isUrgent} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Progress
              value={(answeredCount / totalQuestions) * 100}
              className="h-1.5 bg-bg-elevated"
            />
            <span className="eyebrow shrink-0 tabular-nums">
              {answeredCount}/{totalQuestions} answered
            </span>
          </div>
        </div>

        {/* Question Body */}
        <div className="flex-1 px-5 sm:px-7 pb-7 sm:pb-9 pt-2 space-y-7">
          <h2
            key={`q-${currentQuestionIdx}`}
            className="font-display font-normal tracking-[-0.03em] text-[22px] sm:text-[28px] text-text-primary leading-[1.2] text-pretty break-words animate-fade-in"
          >
            {currentQuestion.question}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((opt, oIndex) => {
              const isSelected = selectedAnswers[currentQuestionIdx] === oIndex;
              return (
                <button
                  key={oIndex}
                  type="button"
                  onClick={() => handleSelectOption(currentQuestionIdx, oIndex)}
                  aria-pressed={isSelected}
                  className={cn(
                    'group w-full text-left p-4 sm:p-5 rounded-[20px] border transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center gap-4 cursor-pointer',
                    isSelected
                      ? 'bg-peach border-transparent ring-2 ring-[#1D9E4B] text-text-primary shadow-[0_10px_30px_-14px_rgba(29,158,75,0.55)]'
                      : 'bg-bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:-translate-y-0.5 hover:shadow-sm'
                  )}
                >
                  <span
                    className={cn(
                      'w-9 h-9 rounded-full font-mono text-xs font-medium flex items-center justify-center flex-shrink-0 transition-colors',
                      isSelected
                        ? 'bg-[#1D9E4B] text-white'
                        : 'bg-bg-elevated text-text-muted group-hover:text-text-primary'
                    )}
                  >
                    {String.fromCharCode(65 + oIndex)}
                  </span>
                  <span className="text-[15px] sm:text-base leading-relaxed flex-1 break-words">
                    {opt}
                  </span>
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all',
                      isSelected ? 'border-[#1D9E4B] bg-[#1D9E4B]' : 'border-border-subtle'
                    )}
                    aria-hidden
                  >
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-t border-border-subtle bg-bg-canvas/60 flex flex-wrap justify-between items-center gap-3">
          <Button
            variant={markedForReview.has(currentQuestionIdx) ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => toggleMarkForReview(currentQuestionIdx)}
            icon={FiFlag}
            className={markedForReview.has(currentQuestionIdx) ? 'text-warning' : ''}
          >
            {markedForReview.has(currentQuestionIdx) ? 'Unflag' : 'Flag for Review'}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentQuestionIdx((prev) => prev - 1)}
              disabled={currentQuestionIdx === 0}
              icon={FiArrowLeft}
            >
              Prev
            </Button>

            {currentQuestionIdx < mcqSet.questions.length - 1 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                icon={FiArrowRight}
              >
                Next Prompt
              </Button>
            ) : (
              <Button
                variant="lime"
                size="sm"
                onClick={() => setShowSubmitModal(true)}
              >
                Finish &amp; Submit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Question Palette (4 cols) */}
      <div className="lg:col-span-4">
        <Card padding="p-6 sm:p-7" className="rounded-[28px] h-full">
          <div className="flex flex-col justify-between h-full">
            <div>
              <Eyebrow dot>Navigator</Eyebrow>
              <h3 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary mt-3 mb-5">
                Prompt <span className="serif italic text-[#1D9E4B]">navigator</span>
              </h3>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs text-text-secondary mb-6 p-4 rounded-[18px] bg-bg-elevated">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-mint ring-1 ring-[#5DAA3A]/40" /> Answered
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-warning-bg ring-1 ring-warning/50" /> Flagged
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-bg-surface ring-1 ring-border-subtle" /> Unseen
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full ring-2 ring-[#1D9E4B]" /> Active
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {mcqSet.questions.map((_, idx) => {
                  const isAnswered = selectedAnswers[idx] !== undefined;
                  const isMarked = markedForReview.has(idx);
                  const isCurrent = currentQuestionIdx === idx;

                  let btnClass =
                    'h-10 rounded-full font-mono text-xs font-medium flex items-center justify-center transition-all cursor-pointer tabular-nums ';

                  if (isCurrent) {
                    btnClass += 'ring-2 ring-[#1D9E4B] ring-offset-2 ring-offset-bg-surface ';
                  }

                  if (isMarked) {
                    btnClass += 'bg-warning-bg text-warning';
                  } else if (isAnswered) {
                    btnClass += 'bg-mint text-[#2F6B12] dark:text-[#A8E07E]';
                  } else {
                    btnClass +=
                      'bg-bg-surface border border-border-subtle text-text-secondary hover:bg-surface-hover hover:text-text-primary';
                  }

                  const statusLabel = isMarked ? 'Flagged' : isAnswered ? 'Answered' : 'Not answered';

                  return (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setCurrentQuestionIdx(idx)}
                          className={btnClass}
                          aria-label={`Question ${idx + 1}: ${statusLabel}`}
                        >
                          {idx + 1}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        Q{idx + 1} · {statusLabel}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-border-subtle">
              <Button
                fullWidth
                variant="primary"
                onClick={() => setShowSubmitModal(true)}
              >
                Submit Assessment
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AssessmentTest;
