const os = require('os');
const env = require('../../../config/env');
const jobRepo = require('./evaluation-job.repository');
const InterviewEvent = require('../../interview-orchestrator/events/interviewEvent.model');
const { InterviewEvaluationRun } = require('../models/interviewEvaluationRun.model');
const { QuestionEvaluation } = require('../models/questionEvaluation.model');
const { CompetencyEvaluation } = require('../models/competencyEvaluation.model');
const { InterviewReport } = require('../models/interviewReport.model');
const { assembleSessionForEvaluation } = require('../assembly/session-assembler');
const { createAnswerEvaluator } = require('../evaluators/answer-evaluator');
const { aggregateCompetencies } = require('../scoring/competency-scorer');
const { calculateCoverage } = require('../scoring/coverage-calculator');
const { calculateOverallScore } = require('../scoring/overall-scorer');
const { generateReports } = require('../reporting/report-generator');
const { createEvaluationRunAndJob } = require('../interview-evaluation.service');

const processEvaluationJob = async (job, { llmProvider = null } = {}) => {
  const run = await InterviewEvaluationRun.findById(job.evaluationRunId);
  if (!run) {
    await jobRepo.markJobFailed(job._id, {
      failureStage: 'LOAD_RUN',
      errorCode: 'RUN_NOT_FOUND',
      errorMessage: 'InterviewEvaluationRun not found',
    });
    return null;
  }

  let currentStage = 'ASSEMBLE_SESSION';
  try {
    run.status = 'PROCESSING';
    run.startedAt = run.startedAt || new Date();
    await run.save();

    const assembled = await assembleSessionForEvaluation(run.sessionId);

    currentStage = 'QUESTION_EVALUATION';
    const evaluator = createAnswerEvaluator({ llmProvider });
    const existingQuestions = await QuestionEvaluation.find({
      evaluationRunId: run._id,
    }).lean();
    const existingByQId = new Map(existingQuestions.map((q) => [q.questionId, q]));

    const batchSize = Math.max(1, env.INTERVIEW_EVALUATION_BATCH_SIZE);
    const pendingAssemblies = assembled.questionAssemblies.filter(
      (qa) => !existingByQId.has(qa.questionId)
    );

    for (let i = 0; i < pendingAssemblies.length; i += batchSize) {
      const batch = pendingAssemblies.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((qa) =>
          evaluator.evaluateQuestion({
            questionAssembly: qa,
            internalBlueprint: assembled.internalBlueprint,
            candidateContext: assembled.candidateContext,
          })
        )
      );

      for (const res of batchResults) {
        const saved = await QuestionEvaluation.findOneAndUpdate(
          { evaluationRunId: run._id, questionId: res.questionId },
          {
            $setOnInsert: {
              ...res,
              evaluationRunId: run._id,
              sessionId: run.sessionId,
            },
          },
          { upsert: true, returnDocument: 'after' }
        ).lean();
        existingByQId.set(res.questionId, saved);
      }
    }

    const allQuestionEvals = assembled.questionAssemblies
      .map((qa) => existingByQId.get(qa.questionId))
      .filter(Boolean);

    currentStage = 'COMPETENCY_AGGREGATION';
    const competencyResults = aggregateCompetencies({
      internalBlueprint: assembled.internalBlueprint,
      questionEvaluations: allQuestionEvals,
      questionAssemblies: assembled.questionAssemblies,
    });

    for (const comp of competencyResults) {
      await CompetencyEvaluation.findOneAndUpdate(
        { evaluationRunId: run._id, competencyId: comp.competencyId },
        { $set: { ...comp, evaluationRunId: run._id } },
        { upsert: true, returnDocument: 'after' }
      );
    }

    currentStage = 'OVERALL_SCORING';
    const coverageSummary = calculateCoverage({ questionEvaluations: allQuestionEvals });
    const overallSummary = calculateOverallScore({
      competencyEvaluations: competencyResults,
      coverageSummary,
      questionEvaluations: allQuestionEvals,
      practiceMode: assembled.session.practiceMode || 'REALISTIC_MOCK',
    });

    const hasWarnings = allQuestionEvals.some(
      (q) => q.reviewRequired || (q.reviewFlags && q.reviewFlags.length > 0)
    );
    let finalRunStatus = 'COMPLETED';
    if (overallSummary.overallStatus === 'INSUFFICIENT_COVERAGE') {
      finalRunStatus = 'INSUFFICIENT_COVERAGE';
    } else if (overallSummary.overallStatus === 'NEEDS_REVIEW') {
      finalRunStatus = 'NEEDS_REVIEW';
    } else if (hasWarnings) {
      finalRunStatus = 'COMPLETED_WITH_WARNINGS';
    }

    run.status = finalRunStatus;
    run.evaluationSummary = overallSummary;
    run.coverageSummary = coverageSummary;
    run.completedAt = new Date();
    run.failureCode = null;
    run.failureMessage = null;
    await run.save();

    currentStage = 'REPORT_GENERATION';
    const { recruiterReport, candidateReport, visibilitySettings } = generateReports({
      run,
      session: assembled.session,
      questionEvaluations: allQuestionEvals,
      competencyEvaluations: competencyResults,
      coverageSummary,
      overallSummary,
    });

    await InterviewReport.findOneAndUpdate(
      { evaluationRunId: run._id, reportVersion: 1 },
      {
        $setOnInsert: {
          evaluationRunId: run._id,
          sessionId: run.sessionId,
          reportVersion: 1,
          candidateReport,
          recruiterReport,
          visibilitySettings,
          generationStatus: 'GENERATED',
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    await InterviewEvent.updateMany(
      {
        sessionId: run.sessionId,
        eventType: 'INTERVIEW_SESSION_COMPLETED',
        outboxStatus: 'PENDING_DISPATCH',
      },
      {
        $set: {
          outboxStatus: 'DISPATCHED',
          dispatchedAt: new Date(),
        },
      }
    );

    await jobRepo.markJobCompleted(job._id);
    return run;
  } catch (err) {
    const canRetry = job.attemptCount < job.maximumAttempts;
    if (canRetry) {
      const backoffMs =
        env.INTERVIEW_EVALUATION_RETRY_DELAY_MS * Math.pow(2, Math.max(0, job.attemptCount - 1));
      run.status = 'PARTIALLY_EVALUATED';
      await run.save();
      await jobRepo.markJobRetryWait(job._id, {
        nextAttemptAt: new Date(Date.now() + backoffMs),
        failureStage: currentStage,
        errorCode: err.code || 'EVALUATION_TRANSIENT_ERROR',
        errorMessage: err.message,
      });
    } else {
      run.status = 'FAILED';
      run.failureCode = err.code || 'EVALUATION_FAILED';
      run.failureMessage = String(err.message || '').slice(0, 500);
      await run.save();
      await jobRepo.markJobFailed(job._id, {
        failureStage: currentStage,
        errorCode: err.code || 'EVALUATION_FAILED',
        errorMessage: err.message,
      });
    }
    return null;
  }
};

const reconcileCompletedSessions = async () => {
  const pendingEvents = await InterviewEvent.find({
    eventType: 'INTERVIEW_SESSION_COMPLETED',
    outboxStatus: 'PENDING_DISPATCH',
  })
    .limit(50)
    .lean();

  for (const evt of pendingEvents) {
    try {
      await createEvaluationRunAndJob({
        sessionIdOrUuid: evt.sessionId,
        bypassOwnership: true,
      });
    } catch (_err) {
      // Skip invalid/incomplete sessions during reconciliation
    }
  }
};

class EvaluationWorker {
  constructor({
    workerId = `eval-worker-${os.hostname()}-${process.pid}`,
    concurrency = env.INTERVIEW_EVALUATION_WORKER_CONCURRENCY,
    leaseMs = env.INTERVIEW_EVALUATION_JOB_LEASE_MS,
    pollIntervalMs = 2000,
    llmProvider = null,
  } = {}) {
    this.workerId = workerId;
    this.concurrency = concurrency;
    this.leaseMs = leaseMs;
    this.pollIntervalMs = pollIntervalMs;
    this.llmProvider = llmProvider;
    this.running = false;
    this.activeCount = 0;
    this.timer = null;
  }

  async start() {
    if (!env.INTERVIEW_EVALUATION_ENABLED || this.running) return;
    this.running = true;

    try {
      await reconcileCompletedSessions();
    } catch (err) {
      console.error('Interview evaluation startup reconciliation failed:', err.message);
    }

    this.scheduleNextTick(50);
  }

  scheduleNextTick(delayMs = this.pollIntervalMs) {
    if (!this.running) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  async tick() {
    if (!this.running) return;

    while (this.running && this.activeCount < this.concurrency) {
      const job = await jobRepo.claimNextJob({
        workerId: this.workerId,
        leaseMs: this.leaseMs,
      });
      if (!job) break;

      this.activeCount += 1;
      void processEvaluationJob(job, { llmProvider: this.llmProvider })
        .catch((err) => {
          console.error('Evaluation worker job error:', err.message);
        })
        .finally(() => {
          this.activeCount -= 1;
          if (this.running) this.scheduleNextTick(10);
        });
    }

    if (this.running) {
      this.scheduleNextTick(this.pollIntervalMs);
    }
  }

  async stop() {
    this.running = false;
    clearTimeout(this.timer);
    while (this.activeCount > 0) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}

module.exports = {
  EvaluationWorker,
  processEvaluationJob,
  reconcileCompletedSessions,
};
