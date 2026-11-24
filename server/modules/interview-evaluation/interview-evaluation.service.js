const crypto = require('crypto');
const AppError = require('../common/errors/AppError');
const env = require('../../config/env');
const { withTransaction } = require('../common/db/transaction');
const { InterviewEvaluationRun } = require('./models/interviewEvaluationRun.model');
const { QuestionEvaluation } = require('./models/questionEvaluation.model');
const { CompetencyEvaluation } = require('./models/competencyEvaluation.model');
const { InterviewReport } = require('./models/interviewReport.model');
const { InterviewEvaluationJob } = require('./models/interviewEvaluationJob.model');
const { EvaluationReviewEvent } = require('./models/evaluationReviewEvent.model');
const {
  findSession,
  assembleSessionForEvaluation,
} = require('./assembly/session-assembler');
const jobRepo = require('./jobs/evaluation-job.repository');

const EVALUATOR_VERSION = '6.0.0';
const EVALUATION_SCHEMA_VERSION = '1.0.0';

const buildEvaluationIdempotencyKey = ({
  sessionId,
  blueprintId,
  blueprintVersion,
  evaluationVersion,
}) =>
  crypto
    .createHash('sha256')
    .update(
      `${sessionId}:${blueprintId}:${blueprintVersion}:${EVALUATION_SCHEMA_VERSION}:${EVALUATOR_VERSION}:v${evaluationVersion}`
    )
    .digest('hex');

const loadAuthorizedSession = async (
  sessionIdOrUuid,
  { userId = null, isRecruiter = false, bypassOwnership = false } = {}
) => {
  const session = await findSession(sessionIdOrUuid);
  if (!session) {
    throw new AppError(404, 'Interview session not found', 'SESSION_NOT_FOUND');
  }
  if (!bypassOwnership && !isRecruiter && session.userId !== userId) {
    throw new AppError(
      403,
      'Not authorized to access this interview evaluation',
      'EVALUATION_FORBIDDEN'
    );
  }
  return session;
};

const createEvaluationRunAndJob = async ({
  sessionIdOrUuid,
  userId = null,
  isRecruiter = false,
  bypassOwnership = false,
  retryReason = null,
  forceNewVersion = false,
}) => {
  const session = await loadAuthorizedSession(sessionIdOrUuid, {
    userId,
    isRecruiter,
    bypassOwnership,
  });

  const latestRun = await InterviewEvaluationRun.findOne({
    sessionId: session._id,
  }).sort({ evaluationVersion: -1 });

  // Deduplicate before assembling the session (the outbox sweep calls this repeatedly).
  if (latestRun && !forceNewVersion) {
    let existingJob = await InterviewEvaluationJob.findOne({
      evaluationRunId: latestRun._id,
    }).lean();
    // The run is created in a transaction and its job right after it. If the process died in
    // between, the run would wait forever with no job to process it: create the missing job.
    if (!existingJob && ['QUEUED', 'PARTIALLY_EVALUATED'].includes(latestRun.status)) {
      existingJob = await jobRepo.createJobIdempotent({
        sessionId: session._id,
        evaluationRunId: latestRun._id,
        idempotencyKey: latestRun.idempotencyKey,
        status: 'QUEUED',
        maximumAttempts: env.INTERVIEW_EVALUATION_MAX_ATTEMPTS,
        nextAttemptAt: new Date(),
      });
    }
    return { run: latestRun.toObject(), job: existingJob, deduplicated: true };
  }

  const assembled = await assembleSessionForEvaluation(session._id);

  const nextVersion = latestRun ? latestRun.evaluationVersion + 1 : 1;
  const idempotencyKey = buildEvaluationIdempotencyKey({
    sessionId: String(session._id),
    blueprintId: String(session.blueprintId),
    blueprintVersion: session.blueprintVersion,
    evaluationVersion: nextVersion,
  });

  const created = await withTransaction(async (dbSession) => {
    if (latestRun && forceNewVersion) {
      await InterviewEvaluationRun.updateOne(
        { _id: latestRun._id },
        { $set: { status: 'SUPERSEDED' } },
        dbSession ? { session: dbSession } : undefined
      );
    }

    const runDoc = {
      sessionId: session._id,
      sessionUuid: session.sessionId,
      intakeId: session.intakeId,
      candidateProfileId: session.candidateProfileId,
      userId: session.userId,
      blueprintId: session.blueprintId,
      blueprintVersion: session.blueprintVersion,
      evaluationVersion: nextVersion,
      evaluatorVersion: EVALUATOR_VERSION,
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      idempotencyKey,
      status: 'QUEUED',
      sessionSnapshotChecksum: assembled.sessionSnapshotChecksum,
      retryReason,
    };

    const [run] = dbSession
      ? await InterviewEvaluationRun.create([runDoc], { session: dbSession })
      : [await InterviewEvaluationRun.create(runDoc)];

    return run;
  });

  const job = await jobRepo.createJobIdempotent({
    sessionId: session._id,
    evaluationRunId: created._id,
    idempotencyKey,
    status: 'QUEUED',
    maximumAttempts: env.INTERVIEW_EVALUATION_MAX_ATTEMPTS,
    nextAttemptAt: new Date(),
  });

  return { run: created.toObject(), job, deduplicated: false };
};

const getLatestRunForSession = async (sessionIdOrUuid, authOpts) => {
  const session = await loadAuthorizedSession(sessionIdOrUuid, authOpts);
  const run = await InterviewEvaluationRun.findOne({
    sessionId: session._id,
  })
    .sort({ evaluationVersion: -1 })
    .lean();
  if (!run) {
    throw new AppError(404, 'Interview evaluation not found', 'EVALUATION_NOT_FOUND');
  }
  return { session, run };
};

const getEvaluationStatus = async (sessionIdOrUuid, authOpts) => {
  const { session, run } = await getLatestRunForSession(sessionIdOrUuid, authOpts);
  const [job, evaluatedCount, blueprintPlanned] = await Promise.all([
    InterviewEvaluationJob.findOne({ evaluationRunId: run._id }).lean(),
    QuestionEvaluation.countDocuments({ evaluationRunId: run._id }),
    assembleSessionForEvaluation(session._id).then((a) => a.questionAssemblies.length).catch(() => 0),
  ]);

  return {
    evaluationRunId: String(run._id),
    sessionId: session.sessionId,
    evaluationVersion: run.evaluationVersion,
    status: run.status,
    evaluatedQuestionsCount: evaluatedCount,
    remainingQuestionsCount: Math.max(0, blueprintPlanned - evaluatedCount),
    lastFailure: job?.lastErrorCode
      ? {
          stage: job.failureStage,
          code: job.lastErrorCode,
          message: job.lastErrorMessage,
        }
      : null,
  };
};

const getQuestionEvaluations = async (sessionIdOrUuid, authOpts, { page = 1, limit = 20 } = {}) => {
  const { run } = await getLatestRunForSession(sessionIdOrUuid, authOpts);
  const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
  const [items, total] = await Promise.all([
    QuestionEvaluation.find({ evaluationRunId: run._id })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    QuestionEvaluation.countDocuments({ evaluationRunId: run._id }),
  ]);
  return { run, items, total, page, limit };
};

const getCompetencyEvaluations = async (sessionIdOrUuid, authOpts) => {
  const { run } = await getLatestRunForSession(sessionIdOrUuid, authOpts);
  const items = await CompetencyEvaluation.find({ evaluationRunId: run._id }).lean();
  return { run, items };
};

const getInterviewReport = async (sessionIdOrUuid, authOpts) => {
  const { run } = await getLatestRunForSession(sessionIdOrUuid, authOpts);
  const report = await InterviewReport.findOne({ evaluationRunId: run._id })
    .sort({ reportVersion: -1 })
    .lean();
  if (!report) {
    throw new AppError(404, 'Interview report not yet generated', 'REPORT_NOT_READY');
  }
  return { run, report };
};

const getReportHistory = async (sessionIdOrUuid, authOpts) => {
  const session = await loadAuthorizedSession(sessionIdOrUuid, authOpts);
  const runs = await InterviewEvaluationRun.find({ sessionId: session._id })
    .sort({ evaluationVersion: -1 })
    .lean();
  const reports = await InterviewReport.find({ sessionId: session._id })
    .sort({ createdAt: -1 })
    .lean();
  return { session, runs, reports };
};

const submitHumanReview = async ({
  evaluationId,
  reviewerId,
  targetType,
  targetId,
  reviewAction,
  revisedScore = null,
  justification,
}) => {
  const run = await InterviewEvaluationRun.findById(evaluationId);
  if (!run) {
    throw new AppError(404, 'Evaluation run not found', 'EVALUATION_NOT_FOUND');
  }

  let originalScore = null;
  if (targetType === 'QUESTION') {
    const qEval = await QuestionEvaluation.findOne({
      evaluationRunId: run._id,
      questionId: targetId,
    });
    if (!qEval) {
      throw new AppError(404, 'Target question evaluation not found', 'QUESTION_EVAL_NOT_FOUND');
    }
    originalScore = qEval.rating;
    qEval.humanOverride = {
      revisedScore: revisedScore ?? qEval.rating,
      reviewAction,
      reviewerId,
      justification,
      reviewedAt: new Date(),
    };
    await qEval.save();
  } else if (targetType === 'COMPETENCY') {
    const cEval = await CompetencyEvaluation.findOne({
      evaluationRunId: run._id,
      competencyId: targetId,
    });
    if (!cEval) {
      throw new AppError(404, 'Target competency evaluation not found', 'COMPETENCY_EVAL_NOT_FOUND');
    }
    originalScore = cEval.score;
    cEval.humanOverride = {
      revisedScore: revisedScore ?? cEval.score,
      reviewAction,
      reviewerId,
      justification,
      reviewedAt: new Date(),
    };
    await cEval.save();
  }

  const nextReviewVersion = (run.latestReviewVersion || 0) + 1;
  const reviewEvent = await EvaluationReviewEvent.create({
    evaluationRunId: run._id,
    reviewerId,
    targetType,
    targetId,
    originalScore,
    revisedScore,
    reviewAction,
    justification,
    reviewVersion: nextReviewVersion,
  });

  run.latestReviewVersion = nextReviewVersion;
  if (reviewAction === 'ACCEPT') run.reviewStatus = 'ACCEPTED';
  else if (reviewAction === 'REQUEST_REVIEW') run.reviewStatus = 'REVIEW_REQUESTED';
  else if (reviewAction === 'ADJUST_SCORE' || reviewAction === 'FLAG_INVALID') {
    run.reviewStatus = 'ADJUSTED';
  } else if (reviewAction === 'APPROVE_REPORT') {
    run.reviewStatus = 'APPROVED';
    await InterviewReport.updateMany(
      { evaluationRunId: run._id },
      { $set: { generationStatus: 'APPROVED' } }
    );
  }
  await run.save();

  return { run: run.toObject(), reviewEvent: reviewEvent.toObject() };
};

const getHumanReviewHistory = async ({ evaluationId }) => {
  const run = await InterviewEvaluationRun.findById(evaluationId).lean();
  if (!run) {
    throw new AppError(404, 'Evaluation run not found', 'EVALUATION_NOT_FOUND');
  }
  const events = await EvaluationReviewEvent.find({ evaluationRunId: run._id })
    .sort({ reviewVersion: 1 })
    .lean();
  return { run, events };
};

module.exports = {
  EVALUATOR_VERSION,
  EVALUATION_SCHEMA_VERSION,
  buildEvaluationIdempotencyKey,
  createEvaluationRunAndJob,
  getEvaluationStatus,
  getQuestionEvaluations,
  getCompetencyEvaluations,
  getLatestRunForSession,
  getInterviewReport,
  getReportHistory,
  submitHumanReview,
  getHumanReviewHistory,
};
