import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiClock, FiCheckCircle, FiXCircle, FiArrowRight,
  FiArrowLeft, FiFlag, FiAward, FiCpu,
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
import EvalixOrb, { EvalixStarburst } from '../components/ui/EvalixOrb';

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <EvalixOrb size="md" state="idle" />
        <h2 className="heading-section text-text-primary mt-4 mb-2">Assessment Not Found</h2>
        <p className="text-sm text-text-secondary mb-6">
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="heading-section text-text-primary mb-2">No Questions Available</h2>
        <p className="text-sm text-text-secondary mb-6">
          There was an error loading the questions for this assessment.
        </p>
        <Button onClick={() => navigate('/mcq-generator')}>Generate New Questions</Button>
      </div>
    );
  }

  // ── 1. Pre-Assessment Briefing Screen ─────────────────────────────────────
  if (!isTestStarted && !isTestFinished) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <SEOHead title={`Timed Assessment: ${mcqSet.jobRole}`} />
        <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-8 sm:p-10 text-center">
          <div className="flex justify-center mb-4">
            <EvalixOrb size="md" state="idle" />
          </div>

          <h1 className="heading-section text-[#F8F5EF] mb-1">{mcqSet.jobRole}</h1>
          <p className="text-xs font-mono uppercase tracking-wider text-[#C7F36B] mb-8">
            Difficulty: {mcqSet.difficulty || 'Standard'}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
            <div className="bg-[#1F1F1F] p-4 rounded-[14px] border border-[#2E2E2E]">
              <p className="text-[#F8F5EF]/60 font-mono text-xs uppercase">Questions</p>
              <p className="font-editorial text-3xl text-[#F8F5EF] mt-1">
                {mcqSet.questions.length}
              </p>
            </div>
            <div className="bg-[#1F1F1F] p-4 rounded-[14px] border border-[#2E2E2E]">
              <p className="text-[#F8F5EF]/60 font-mono text-xs uppercase">Time Limit</p>
              <p className="font-editorial text-3xl text-[#C7F36B] mt-1">
                {Math.round(mcqSet.questions.length * 1.5)}m
              </p>
            </div>
          </div>

          <div className="bg-[#1F1F1F] border border-[#2E2E2E] p-5 rounded-[16px] text-left mb-8">
            <h4 className="font-mono text-xs uppercase tracking-widest text-[#FF6B35] font-bold mb-2.5">
              Assessment Format
            </h4>
            <ul className="text-xs sm:text-sm text-[#F8F5EF]/80 space-y-1.5">
              <li>• <strong className="text-white">90 seconds per question</strong>; auto-submits when the timer reaches 00:00.</li>
              <li>• Jump between questions using the right-hand <strong className="text-white">Question Navigator</strong>.</li>
              <li>• Flag uncertain items for review before submitting.</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="secondary" onClick={() => navigate('/mcq-generator')}>
              Back to MCQ Sets
            </Button>
            <Button size="lg" variant="primary" onClick={handleStartTest}>
              Start Timed Assessment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. Post-Assessment Scorecard Screen ───────────────────────────────────
  if (isTestFinished && assessmentResult) {
    const score = Math.round(assessmentResult.score || 0);
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <SEOHead title={`Assessment Scorecard: ${assessmentResult.jobRole}`} />

        {/* Score Banner */}
        <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left border-b lg:border-b-0 lg:border-r border-[#2E2E2E] pb-6 lg:pb-0 lg:pr-6">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#F8F5EF]/60 mb-2">
                Final Score
              </span>
              <div className="font-editorial text-6xl sm:text-7xl leading-none text-[#C7F36B]">
                <AnimatedCounter value={score} />%
              </div>
              <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-[#FF6B35] text-white">
                {score >= 80
                  ? 'Strong Score'
                  : score >= 60
                  ? 'Passing Score'
                  : 'Needs Review'}
              </span>
            </div>

            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-[14px] bg-[#1F1F1F] border border-[#2E2E2E] text-center">
                <span className="text-[11px] font-mono uppercase text-[#F8F5EF]/60 block">
                  Time Taken
                </span>
                <span className="font-mono font-bold text-xl text-[#F8F5EF] mt-1 block">
                  {formatTime(assessmentResult.timeTaken)}
                </span>
              </div>
              <div className="p-4 rounded-[14px] bg-[#1F1F1F] border border-[#2E2E2E] text-center">
                <span className="text-[11px] font-mono uppercase text-[#F8F5EF]/60 block">
                  Accuracy
                </span>
                <span className="font-mono font-bold text-xl text-[#8174FF] mt-1 block">
                  {assessmentResult.accuracy}%
                </span>
              </div>
              <div className="p-4 rounded-[14px] bg-[#1F1F1F] border border-[#C7F36B]/40 text-center">
                <span className="text-[11px] font-mono uppercase text-[#C7F36B] block">
                  Correct
                </span>
                <span className="font-mono font-bold text-xl text-[#C7F36B] mt-1 block">
                  {assessmentResult.correctAnswers}
                </span>
              </div>
              <div className="p-4 rounded-[14px] bg-[#1F1F1F] border border-[#EF4444]/40 text-center">
                <span className="text-[11px] font-mono uppercase text-[#EF4444] block">
                  Incorrect
                </span>
                <span className="font-mono font-bold text-xl text-[#EF4444] mt-1 block">
                  {assessmentResult.incorrectAnswers}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Question Review */}
        <Card className="p-6 border-2 border-border-subtle">
          <div className="flex flex-wrap justify-between items-center gap-3 pb-4 mb-6 border-b border-border-subtle">
            <div>
              <h3 className="heading-card text-text-primary">Answer Key &amp; Explanations</h3>
              <p className="text-xs text-text-muted">
                Inspect every prompt alongside your selection and the verified explanation
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>

          <div className="space-y-5">
            {mcqSet.questions.map((q, qIndex) => {
              const answerData = assessmentResult.answers.find(
                (a) => a.questionIndex === qIndex
              );
              const userAnswerIndex = answerData?.selectedAnswer;
              const isCorrect = answerData?.isCorrect;
              const isUnanswered = userAnswerIndex === undefined;

              return (
                <div
                  key={qIndex}
                  className="p-5 border-2 border-border-subtle rounded-[16px] bg-bg-canvas space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {isCorrect ? (
                          <FiCheckCircle className="text-emerald-600 dark:text-[#C7F36B] w-5 h-5" />
                        ) : isUnanswered ? (
                          <span className="px-2 py-0.5 rounded bg-border-subtle font-mono text-xs text-text-muted">
                            SKIP
                          </span>
                        ) : (
                          <FiXCircle className="text-[#EF4444] w-5 h-5" />
                        )}
                      </div>
                      <h4 className="font-display font-bold text-base text-text-primary">
                        <span className="font-mono text-text-muted mr-2">
                          Q{String(qIndex + 1).padStart(2, '0')}.
                        </span>
                        {q.question}
                      </h4>
                    </div>
                    <Badge variant="default">{q.topic || 'Core'}</Badge>
                  </div>

                  <div className="space-y-2">
                    {q.options.map((opt, oIndex) => {
                      const isOptionCorrect = oIndex === q.correctAnswer;
                      const isOptionSelected = oIndex === userAnswerIndex;

                      let optClass =
                        'p-3 rounded-[10px] border text-sm flex justify-between items-center ';

                      if (isOptionCorrect) {
                        optClass +=
                          'border-emerald-600 bg-emerald-500/15 text-text-primary font-semibold';
                      } else if (isOptionSelected && !isOptionCorrect) {
                        optClass +=
                          'border-[#EF4444] bg-[#EF4444]/15 text-[#EF4444] font-medium';
                      } else {
                        optClass += 'border-border-subtle bg-bg-surface text-text-secondary';
                      }

                      return (
                        <div key={oIndex} className={optClass}>
                          <span>
                            <strong className="font-mono mr-2">
                              {String.fromCharCode(65 + oIndex)}.
                            </strong>
                            {opt}
                          </span>
                          <div className="flex gap-2">
                            {isOptionSelected && (
                              <span className="text-[10px] font-mono uppercase bg-[#151515] text-[#F8F5EF] px-2 py-0.5 rounded">
                                Your Pick
                              </span>
                            )}
                            {isOptionCorrect && (
                              <span className="text-[10px] font-mono uppercase bg-[#C7F36B] text-[#151515] font-bold px-2 py-0.5 rounded">
                                Correct
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle">
                    <p className="text-xs font-mono uppercase tracking-wider text-[#FF6B35] font-bold mb-1">
                      Concept Explanation
                    </p>
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                      {q.explanation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  // ── 3. Active Timed Assessment Runner ─────────────────────────────────────
  const currentQuestion = mcqSet.questions[currentQuestionIdx];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-8rem)] pb-8">
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

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-[12px] bg-bg-canvas border border-border-subtle">
              <div className="font-editorial text-2xl text-emerald-600 dark:text-[#C7F36B]">
                {Object.keys(selectedAnswers).length}
              </div>
              <div className="text-xs font-mono text-text-muted uppercase">Answered</div>
            </div>
            <div className="p-3 rounded-[12px] bg-bg-canvas border border-border-subtle">
              <div className="font-editorial text-2xl text-[#F59E0B]">
                {markedForReview.size}
              </div>
              <div className="text-xs font-mono text-text-muted uppercase">Flagged</div>
            </div>
            <div className="p-3 rounded-[12px] bg-bg-canvas border border-border-subtle">
              <div className="font-editorial text-2xl text-text-primary">
                {mcqSet.questions.length - Object.keys(selectedAnswers).length}
              </div>
              <div className="text-xs font-mono text-text-muted uppercase">Remaining</div>
            </div>
          </div>

          <div className="flex gap-3">
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
      <div className="lg:col-span-8 flex flex-col justify-between rounded-[22px] bg-bg-surface border-2 border-border-subtle overflow-hidden">
        {/* Top Telemetry Bar */}
        <div className="p-4 sm:p-5 bg-[#151515] text-[#F8F5EF] flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full bg-[#FF6B35] text-white font-mono text-xs font-bold">
              Q{String(currentQuestionIdx + 1).padStart(2, '0')} /{' '}
              {String(mcqSet.questions.length).padStart(2, '0')}
            </span>
            {markedForReview.has(currentQuestionIdx) && (
              <span className="px-2.5 py-1 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] font-mono text-xs flex items-center gap-1">
                <FiFlag /> Flagged
              </span>
            )}
          </div>

          <div
            className={`flex items-center gap-2 font-mono text-sm font-bold px-3.5 py-1.5 rounded-[10px] border ${
              timeLeft < 60
                ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444] animate-pulse'
                : 'bg-[#1F1F1F] border-[#2E2E2E] text-[#C7F36B]'
            }`}
          >
            <FiClock />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Question Body */}
        <div className="flex-1 p-6 sm:p-8 space-y-6">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-text-primary leading-snug">
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
                  className={`w-full text-left p-4 rounded-[14px] border-2 transition-all flex items-center gap-3.5 cursor-pointer ${
                    isSelected
                      ? 'border-[#151515] dark:border-[#FF6B35] bg-[#FF6B35]/15 text-text-primary shadow-[0_3px_0_0_#151515]'
                      : 'border-border-subtle bg-bg-canvas hover:border-text-primary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-[8px] font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'bg-[#FF6B35] text-white'
                        : 'bg-bg-surface border border-border-subtle text-text-muted'
                    }`}
                  >
                    {String.fromCharCode(65 + oIndex)}
                  </span>
                  <span className="text-sm sm:text-base font-medium leading-relaxed flex-1">
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        <div className="p-4 sm:p-5 border-t-2 border-border-subtle bg-bg-canvas flex flex-wrap justify-between items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toggleMarkForReview(currentQuestionIdx)}
            icon={FiFlag}
          >
            {markedForReview.has(currentQuestionIdx) ? 'Unflag' : 'Flag for Review'}
          </Button>

          <div className="flex items-center gap-2.5">
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
        <Card className="p-6 border-2 border-border-subtle flex flex-col justify-between h-full">
          <div>
            <h3 className="heading-card text-text-primary mb-4">Prompt Navigator</h3>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-text-secondary mb-5 p-3 rounded-[12px] bg-bg-canvas border border-border-subtle">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#C7F36B] border border-[#151515]" /> Answered
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#F59E0B]" /> Flagged
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-bg-surface border border-border-subtle" /> Unseen
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded border-2 border-[#FF6B35]" /> Active
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {mcqSet.questions.map((_, idx) => {
                const isAnswered = selectedAnswers[idx] !== undefined;
                const isMarked = markedForReview.has(idx);
                const isCurrent = currentQuestionIdx === idx;

                let btnClass =
                  'h-10 rounded-[10px] font-mono text-xs font-bold flex items-center justify-center transition-all cursor-pointer ';

                if (isCurrent) {
                  btnClass += 'ring-2 ring-[#FF6B35] ';
                }

                if (isMarked) {
                  btnClass += 'bg-[#F59E0B] text-[#151515]';
                } else if (isAnswered) {
                  btnClass += 'bg-[#C7F36B] text-[#151515] border border-[#151515]';
                } else {
                  btnClass +=
                    'bg-bg-canvas border border-border-subtle text-text-secondary hover:border-text-primary';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentQuestionIdx(idx)}
                    className={btnClass}
                  >
                    {idx + 1}
                  </button>
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
        </Card>
      </div>
    </div>
  );
};

export default AssessmentTest;
