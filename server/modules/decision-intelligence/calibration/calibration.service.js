const env = require('../../../config/env');
const { EvaluationCalibrationObservation } = require('./evaluationCalibrationObservation.model');
const { EvaluationCalibrationSummary } = require('./evaluationCalibrationSummary.model');
const { EvaluationReviewEvent } = require('../../interview-evaluation/models/evaluationReviewEvent.model');
const { QuestionEvaluation } = require('../../interview-evaluation/models/questionEvaluation.model');

const recordCalibrationObservationsForRun = async ({
  organizationId,
  evaluationRun,
  questionEvaluations = [],
}) => {
  if (!organizationId || !evaluationRun) return [];

  const reviewEvents = await EvaluationReviewEvent.find({
    evaluationRunId: evaluationRun._id,
    targetType: 'QUESTION',
    reviewAction: { $in: ['ADJUST_SCORE', 'ACCEPT'] },
  }).lean();

  const qById = new Map(questionEvaluations.map((q) => [q.questionId, q]));
  const created = [];

  for (const evt of reviewEvents) {
    const qEval = qById.get(evt.targetId);
    if (!qEval || typeof qEval.rating !== 'number') continue;

    const humanScore = evt.revisedScore ?? qEval.rating;
    const diff = Math.round((humanScore - qEval.rating) * 100) / 100;

    const obs = await EvaluationCalibrationObservation.findOneAndUpdate(
      { reviewEventId: evt._id },
      {
        $setOnInsert: {
          organizationId,
          evaluationRunId: evaluationRun._id,
          questionEvaluationId: qEval._id || null,
          competencyId: qEval.competencyId || 'UNKNOWN',
          questionType: qEval.questionType || 'TECHNICAL',
          originalAiScore: qEval.rating,
          humanReviewedScore: humanScore,
          scoreDifference: diff,
          rubricVersion: '1.0',
          evaluatorVersion: evaluationRun.evaluatorVersion || '6.0.0',
          promptVersion: qEval.llmMetadata?.promptVersion || 'module6.answer_evaluator.v1',
          reviewReason: evt.justification,
          reviewEventId: evt._id,
        },
      },
      { upsert: true, returnDocument: 'after' }
    ).lean();
    created.push(obs);
  }

  return created;
};

const computeOrganizationCalibration = async ({
  organizationId,
  minSamples = env.DECISION_INTELLIGENCE_CALIBRATION_MIN_SAMPLES,
}) => {
  const observations = await EvaluationCalibrationObservation.find({
    organizationId,
  }).lean();

  if (observations.length < minSamples) {
    return {
      organizationId,
      belowMinimumSampleThreshold: true,
      minimumRequiredSamples: minSamples,
      currentSampleCount: observations.length,
      note: 'Aggregate calibration statistics are suppressed until the minimum sample threshold is reached. Calibration never automatically modifies prompts, weights, or candidate scores.',
      summaries: [],
    };
  }

  const groups = new Map();
  for (const obs of observations) {
    const key = `${obs.competencyId}::${obs.rubricVersion}::${obs.evaluatorVersion}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(obs);
  }

  const summaries = [];
  for (const [, groupObs] of groups.entries()) {
    const first = groupObs[0];
    const sampleCount = groupObs.length;
    const avgDiff =
      Math.round(
        (groupObs.reduce((acc, o) => acc + o.scoreDifference, 0) / sampleCount) * 100
      ) / 100;
    const mad =
      Math.round(
        (groupObs.reduce((acc, o) => acc + Math.abs(o.scoreDifference), 0) / sampleCount) * 100
      ) / 100;
    const overrides = groupObs.filter((o) => o.scoreDifference !== 0).length;
    const overrideRate = Math.round((overrides / sampleCount) * 1000) / 1000;
    const exactAgreementRate = Math.round(((sampleCount - overrides) / sampleCount) * 1000) / 1000;

    const saved = await EvaluationCalibrationSummary.findOneAndUpdate(
      {
        organizationId,
        competencyId: first.competencyId,
        rubricVersion: first.rubricVersion,
        evaluatorVersion: first.evaluatorVersion,
      },
      {
        $set: {
          sampleCount,
          averageScoreDifference: avgDiff,
          meanAbsoluteDifference: mad,
          reviewerOverrideRate: overrideRate,
          agreementStatistics: {
            exactAgreementRate,
            overrideCount: overrides,
          },
        },
        $inc: { reportVersion: 1 },
      },
      { upsert: true, returnDocument: 'after' }
    ).lean();

    summaries.push(saved);
  }

  return {
    organizationId,
    belowMinimumSampleThreshold: false,
    minimumRequiredSamples: minSamples,
    currentSampleCount: observations.length,
    note: 'Correlation/override telemetry for human quality review only; no automatic prompt or score adjustments are performed.',
    summaries,
  };
};

module.exports = {
  recordCalibrationObservationsForRun,
  computeOrganizationCalibration,
};
