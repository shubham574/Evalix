const os = require('os');
const env = require('../../../config/env');
const { LeasePollingWorker } = require('../../common/jobs/polling-worker');
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
const AppError = require('../../common/errors/AppError');

const processEvaluationJob = async (job, { llmProvider = null } = {}) => {
  const run = await InterviewEvaluationRun.findById(job.evaluationRunId);
  if (!run) {
    await jobRepo.markJobFailed(job, {
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

    await jobRepo.markJobCompleted(job);
    return run;
  } catch (err) {
    const canRetry = job.attemptCount < job.maximumAttempts;
    // Persist the run status best-effort: if this save fails (DB blip, version conflict) the job
    // must still leave PROCESSING, otherwise it sits locked until its lease expires.
    const saveRunStatus = async (fields) => {
      try {
        Object.assign(run, fields);
        await run.save();
      } catch (saveErr) {
        console.error('Evaluation run status save failed:', saveErr.message);
      }
    };
    if (canRetry) {
      const backoffMs =
        env.INTERVIEW_EVALUATION_RETRY_DELAY_MS * Math.pow(2, Math.max(0, job.attemptCount - 1));
      await saveRunStatus({ status: 'PARTIALLY_EVALUATED' });
      await jobRepo.markJobRetryWait(job, {
        nextAttemptAt: new Date(Date.now() + backoffMs),
        failureStage: currentStage,
        errorCode: err.code || 'EVALUATION_TRANSIENT_ERROR',
        errorMessage: err.message,
      });
    } else {
      await saveRunStatus({
        status: 'FAILED',
        failureCode: err.code || 'EVALUATION_FAILED',
        failureMessage: String(err.message || '').slice(0, 500),
      });
      await markSessionOutbox(run.sessionId, 'FAILED', {
        failureCode: err.code || 'EVALUATION_FAILED',
      });
      await jobRepo.markJobFailed(job, {
        failureStage: currentStage,
        errorCode: err.code || 'EVALUATION_FAILED',
        errorMessage: err.message,
      });
    }
    return null;
  }
};

const TERMINAL_RUN_STATUSES = new Set([
  'COMPLETED',
  'COMPLETED_WITH_WARNINGS',
  'NEEDS_REVIEW',
  'INSUFFICIENT_COVERAGE',
]);

/** Close a session's pending INTERVIEW_SESSION_COMPLETED outbox entry. */
const markSessionOutbox = async (sessionId, outboxStatus, details = {}) => {
  try {
    await InterviewEvent.updateMany(
      {
        sessionId,
        eventType: 'INTERVIEW_SESSION_COMPLETED',
        outboxStatus: 'PENDING_DISPATCH',
      },
      {
        $set: {
          outboxStatus,
          dispatchedAt: new Date(),
          ...Object.fromEntries(
            Object.entries(details).map(([k, v]) => [`payload.outbox${k[0].toUpperCase()}${k.slice(1)}`, v])
          ),
        },
      }
    );
  } catch (err) {
    console.error('Outbox status update failed:', err.message);
  }
};

/**
 * Consume pending INTERVIEW_SESSION_COMPLETED outbox events (oldest first) and make sure each
 * completed session has an evaluation run with a job. Runs at startup and periodically.
 *
 * Entries whose outcome is final are closed (DISPATCHED / FAILED) so they no longer occupy the
 * sweep window; otherwise a backlog of permanently failing sessions would starve new ones.
 * Transient errors leave the entry pending for the next sweep.
 */
const reconcileCompletedSessions = async () => {
  const pendingEvents = await InterviewEvent.find({
    eventType: 'INTERVIEW_SESSION_COMPLETED',
    outboxStatus: 'PENDING_DISPATCH',
  })
    .sort({ occurredAt: 1 })
    .limit(50)
    .lean();

  for (const evt of pendingEvents) {
    try {
      const { run } = await createEvaluationRunAndJob({
        sessionIdOrUuid: evt.sessionId,
        bypassOwnership: true,
      });
      if (run && TERMINAL_RUN_STATUSES.has(run.status)) {
        await markSessionOutbox(evt.sessionId, 'DISPATCHED');
      } else if (run && run.status === 'FAILED') {
        await markSessionOutbox(evt.sessionId, 'FAILED', { failureCode: run.failureCode || 'EVALUATION_FAILED' });
      }
    } catch (err) {
      // 4xx AppErrors (session missing / not eligible for evaluation) will never succeed.
      if (err instanceof AppError && err.statusCode >= 400 && err.statusCode < 500) {
        await markSessionOutbox(evt.sessionId, 'FAILED', { failureCode: err.code || 'NOT_EVALUABLE' });
      }
    }
  }
};

class EvaluationWorker extends LeasePollingWorker {
  constructor({
    workerId = `eval-worker-${os.hostname()}-${process.pid}`,
    concurrency = env.INTERVIEW_EVALUATION_WORKER_CONCURRENCY,
    leaseMs = env.INTERVIEW_EVALUATION_JOB_LEASE_MS,
    pollIntervalMs = 2000,
    llmProvider = null,
  } = {}) {
    super({
      name: 'Interview evaluation worker',
      workerId,
      concurrency,
      leaseMs,
      pollIntervalMs,
      enabled: env.INTERVIEW_EVALUATION_ENABLED,
      claim: (args) => jobRepo.claimNextJob(args),
      process: (job) => processEvaluationJob(job, { llmProvider: this.llmProvider }),
      renew: (job, ms) => jobRepo.renewJobLease(job, ms),
      // Fail exhausted leases, then consume new INTERVIEW_SESSION_COMPLETED outbox events.
      // Previously the outbox was only read once at startup, so sessions completed while the
      // server was running were never evaluated automatically until the next restart.
      recoverIntervalMs: 15000,
      recover: async () => {
        await jobRepo.recoverExpiredLeases();
        await reconcileCompletedSessions();
      },
    });
    this.llmProvider = llmProvider;
  }
}

module.exports = {
  EvaluationWorker,
  processEvaluationJob,
  reconcileCompletedSessions,
};
