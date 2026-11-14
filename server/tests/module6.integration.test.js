const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

const app = require('../app');
const env = require('../config/env');
const { CandidateProfile } = require('../modules/candidate/candidateProfile.model');
const { TargetJobProfile } = require('../modules/job-profile/targetJobProfile.model');
const { InterviewIntake } = require('../modules/intake/interviewIntake.model');
const { CandidateJobAnalysis } = require('../modules/candidate-intelligence/analysis/candidateJobAnalysis.model');
const { InterviewBlueprint } = require('../modules/interview-blueprint/models/interviewBlueprint.model');
const InterviewSession = require('../modules/interview-orchestrator/session/interviewSession.model');
const InterviewTurn = require('../modules/interview-orchestrator/turns/interviewTurn.model');
const InterviewEvent = require('../modules/interview-orchestrator/events/interviewEvent.model');
const {
  computeBlueprintChecksum,
} = require('../modules/interview-orchestrator/runtime/interview-runtime.service');
const {
  toInternalOrchestratorBlueprint,
} = require('../modules/interview-blueprint/serializers/blueprint.serializer');
const { InterviewEvaluationRun } = require('../modules/interview-evaluation/models/interviewEvaluationRun.model');
const { QuestionEvaluation } = require('../modules/interview-evaluation/models/questionEvaluation.model');
const { CompetencyEvaluation } = require('../modules/interview-evaluation/models/competencyEvaluation.model');
const { InterviewReport } = require('../modules/interview-evaluation/models/interviewReport.model');
const { InterviewEvaluationJob } = require('../modules/interview-evaluation/models/interviewEvaluationJob.model');
const { EvaluationReviewEvent } = require('../modules/interview-evaluation/models/evaluationReviewEvent.model');
const jobRepo = require('../modules/interview-evaluation/jobs/evaluation-job.repository');
const {
  processEvaluationJob,
  reconcileCompletedSessions,
} = require('../modules/interview-evaluation/jobs/evaluation.worker');

const CANDIDATE_A = { 'x-test-user-id': 'user_m6_a' };
const CANDIDATE_B = { 'x-test-user-id': 'user_m6_b' };
const RECRUITER_A = { 'x-test-user-id': 'recruiter_m6', 'x-user-role': 'RECRUITER' };

let replSet;

const seedCompletedInterview = async ({ userId = 'user_m6_a' } = {}) => {
  let candidate = await CandidateProfile.findOne({ userId });
  if (!candidate) {
    candidate = await CandidateProfile.create({
      userId,
      fullName: 'Shubham Maurya',
      email: 'shubham6@evalix.dev',
      phone: '+91-9999900006',
      currentJobTitle: 'Backend Node.js Engineer',
      totalExperienceMonths: 36,
      experienceLevel: 'MID',
    });
  }
  const jobProfile = await TargetJobProfile.create({
    candidateProfileId: candidate._id,
    userId,
    targetRole: 'Backend Node.js Engineer',
    targetCompany: 'Evalix',
  });
  const intake = await InterviewIntake.create({
    userId,
    candidateProfileId: candidate._id,
    targetJobProfileId: jobProfile._id,
    resumeDocumentId: new mongoose.Types.ObjectId(),
    interviewPreferences: { interviewType: 'TECHNICAL', durationMinutes: 30, difficulty: 'ADAPTIVE' },
    status: 'READY_FOR_ANALYSIS',
    submittedAt: new Date(),
  });
  const analysis = await CandidateJobAnalysis.create({
    intakeId: intake._id,
    candidateProfileId: candidate._id,
    userId,
    targetJobProfileId: jobProfile._id,
    resumeExtractionId: new mongoose.Types.ObjectId(),
    jobDescriptionExtractionId: new mongoose.Types.ObjectId(),
    analysisVersion: 1,
    analysisStatus: 'READY_FOR_INTERVIEW_PLANNING',
  });

  const makeRubric = (rubricId, questionId, competencyId) => ({
    rubricId,
    questionId,
    competencyId,
    ratingScale: '1-5',
    ratingDescriptors: [1, 2, 3, 4, 5].map((r) => ({
      rating: r,
      label: `Level ${r}`,
      descriptor: `Descriptor for level ${r}`,
    })),
    expectedEvidence: ['Explains core mechanism and trade-offs'],
  });

  const blueprint = await InterviewBlueprint.create({
    intakeId: intake._id,
    candidateProfileId: candidate._id,
    candidateAnalysisId: analysis._id,
    userId,
    blueprintVersion: 1,
    status: 'READY',
    isLockedForSession: true,
    interviewType: 'TECHNICAL',
    targetRole: 'Backend Node.js Engineer',
    seniorityLevel: 'MID',
    totalDurationSeconds: 1800,
    competencyPlan: [
      { competencyId: 'comp_node', name: 'Node.js & Async', weight: 0.6 },
      { competencyId: 'comp_db', name: 'Database Design', weight: 0.4 },
    ],
    stages: [
      { stageId: 'stg_1', stageType: 'CORE_TECHNICAL', stageName: 'Node.js', durationSeconds: 900, order: 1 },
      { stageId: 'stg_2', stageType: 'SYSTEM_DESIGN', stageName: 'Database', durationSeconds: 900, order: 2 },
    ],
    questionPlan: [
      {
        questionId: 'q_node_1',
        stageId: 'stg_1',
        consistencyClass: 'CORE_ASSESSMENT',
        competencyId: 'comp_node',
        questionText: 'Explain the Node.js event loop.',
        evaluationRubricId: 'rub_node_1',
        order: 1,
      },
      {
        questionId: 'q_db_1',
        stageId: 'stg_2',
        consistencyClass: 'CORE_ASSESSMENT',
        competencyId: 'comp_db',
        questionText: 'Explain MongoDB compound indexing.',
        evaluationRubricId: 'rub_db_1',
        order: 2,
      },
      {
        questionId: 'q_db_2',
        stageId: 'stg_2',
        consistencyClass: 'CORE_ASSESSMENT',
        competencyId: 'comp_db',
        questionText: 'Explain sharding trade-offs.',
        evaluationRubricId: 'rub_db_2',
        order: 3,
      },
    ],
    evaluationRubrics: [
      makeRubric('rub_node_1', 'q_node_1', 'comp_node'),
      makeRubric('rub_db_1', 'q_db_1', 'comp_db'),
      makeRubric('rub_db_2', 'q_db_2', 'comp_db'),
    ],
  });

  const internalBp = toInternalOrchestratorBlueprint(blueprint);
  const checksum = computeBlueprintChecksum(internalBp);

  const session = await InterviewSession.create({
    sessionId: `sess_m6_${new mongoose.Types.ObjectId()}`,
    userId,
    intakeId: intake._id,
    candidateProfileId: candidate._id,
    candidateAnalysisId: analysis._id,
    blueprintId: blueprint._id,
    blueprintVersion: 1,
    blueprintChecksum: checksum,
    interviewType: 'TECHNICAL',
    targetRole: 'Backend Node.js Engineer',
    seniorityLevel: 'MID',
    status: 'COMPLETED',
    askedQuestionIds: ['q_node_1', 'q_db_1'],
    completedQuestionIds: ['q_node_1', 'q_db_1'],
    coveredCompetencyIds: ['comp_node', 'comp_db'],
    stageProgress: [
      { stageId: 'stg_1', stageType: 'CORE_TECHNICAL', title: 'Node.js', status: 'COMPLETED' },
      { stageId: 'stg_2', stageType: 'SYSTEM_DESIGN', title: 'Database', status: 'COMPLETED' },
    ],
    totalDurationSeconds: 1800,
    activeDurationSeconds: 900,
    startedAt: new Date(Date.now() - 900000),
    completedAt: new Date(),
  });

  const t1 = await InterviewTurn.create({
    sessionId: session._id,
    turnNumber: 1,
    idempotencyKey: 'k1',
    speaker: 'AI',
    turnType: 'CORE_QUESTION',
    stageId: 'stg_1',
    questionId: 'q_node_1',
    spokenText: 'Explain the Node.js event loop.',
  });
  const t2 = await InterviewTurn.create({
    sessionId: session._id,
    turnNumber: 2,
    idempotencyKey: 'k2',
    speaker: 'CANDIDATE',
    turnType: 'CANDIDATE_ANSWER',
    stageId: 'stg_1',
    questionId: 'q_node_1',
    spokenText: 'Node.js uses libuv phases and drains Promise microtasks between phases.',
    transcriptStatus: 'FINAL',
  });
  const t3 = await InterviewTurn.create({
    sessionId: session._id,
    turnNumber: 3,
    idempotencyKey: 'k3',
    speaker: 'AI',
    turnType: 'CORE_QUESTION',
    stageId: 'stg_2',
    questionId: 'q_db_1',
    spokenText: 'Explain MongoDB compound indexing.',
  });
  const t4 = await InterviewTurn.create({
    sessionId: session._id,
    turnNumber: 4,
    idempotencyKey: 'k4',
    speaker: 'CANDIDATE',
    turnType: 'CANDIDATE_ANSWER',
    stageId: 'stg_2',
    questionId: 'q_db_1',
    spokenText: 'We follow the Equality, Sort, Range rule to optimize compound indexes.',
    transcriptStatus: 'FINAL',
  });

  await InterviewEvent.create({
    eventId: `evt_${new mongoose.Types.ObjectId()}`,
    sessionId: session._id,
    intakeId: intake._id,
    eventType: 'INTERVIEW_SESSION_COMPLETED',
    payload: { sessionId: session.sessionId },
    outboxStatus: 'PENDING_DISPATCH',
  });

  return { session, blueprint, t2, t4 };
};

describe('Module 6 Integration Tests — Evaluation Worker, Evidence Verification, Reports, Human Review & Security', () => {
  let llmCallCount = 0;

  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    llmCallCount = 0;
    await Promise.all([
      CandidateProfile.deleteMany({}),
      TargetJobProfile.deleteMany({}),
      InterviewIntake.deleteMany({}),
      CandidateJobAnalysis.deleteMany({}),
      InterviewBlueprint.deleteMany({}),
      InterviewSession.deleteMany({}),
      InterviewTurn.deleteMany({}),
      InterviewEvent.deleteMany({}),
      InterviewEvaluationRun.deleteMany({}),
      QuestionEvaluation.deleteMany({}),
      CompetencyEvaluation.deleteMany({}),
      InterviewReport.deleteMany({}),
      InterviewEvaluationJob.deleteMany({}),
      EvaluationReviewEvent.deleteMany({}),
    ]);
  });

  it('reconciles INTERVIEW_SESSION_COMPLETED outbox, evaluates with verified evidence, marks NOT_ASKED, and separates candidate/recruiter reports', async () => {
    const { session, t2, t4 } = await seedCompletedInterview();

    await reconcileCompletedSessions();
    const job = await jobRepo.claimNextJob({ workerId: 'test-w1', leaseMs: 60000 });
    assert.ok(job);

    const fakeLlm = {
      generateStructuredJson: async ({ userPrompt }) => {
        llmCallCount += 1;
        if (userPrompt.includes('"questionId": "q_node_1"')) {
          return {
            provider: 'fake',
            model: 'fake-gemini',
            data: {
              rating: 4,
              criterionEvaluations: [{ criterionId: 'crit_1', status: 'DEMONSTRATED', comment: 'Clear libuv and microtask explanation.' }],
              evidenceReferences: [
                { turnId: String(t2._id), quote: 'Node.js uses libuv phases and drains Promise microtasks between phases.' },
              ],
              strengths: ['Understands libuv phases and microtasks'],
              developmentAreas: ['Could mention process.nextTick priority'],
              missingEvidence: [],
              explanation: 'Strong technical explanation backed by candidate transcript.',
            },
          };
        }
        return {
          provider: 'fake',
          model: 'fake-gemini',
          data: {
            rating: 5,
            criterionEvaluations: [{ criterionId: 'crit_db', status: 'DEMONSTRATED', comment: 'Applied ESR rule accurately.' }],
            evidenceReferences: [
              { turnId: String(t4._id), quote: 'We follow the Equality, Sort, Range rule to optimize compound indexes.' },
            ],
            strengths: ['Applies ESR rule for MongoDB indexes'],
            developmentAreas: [],
            missingEvidence: [],
            explanation: 'Excellent practical MongoDB indexing answer.',
          },
        };
      },
    };

    const run = await processEvaluationJob(job, { llmProvider: fakeLlm });
    assert.ok(run);
    assert.strictEqual(llmCallCount, 2); // q_db_2 was NOT_ASKED -> deterministic without LLM

    // Outbox event marked DISPATCHED
    const evt = await InterviewEvent.findOne({ sessionId: session._id, eventType: 'INTERVIEW_SESSION_COMPLETED' });
    assert.strictEqual(evt.outboxStatus, 'DISPATCHED');

    // Candidate report hides numeric scores & private rubrics
    const candRepRes = await request(app)
      .get(`/api/v1/interview-sessions/${session.sessionId}/report`)
      .set(CANDIDATE_A);
    assert.strictEqual(candRepRes.status, 200);
    assert.strictEqual(candRepRes.body.data.report.overallFeedback.overallScore, undefined);
    assert.strictEqual(candRepRes.body.data.report.questionResults, undefined);

    // Recruiter report includes full rubric ratings, evidence quotes, coverage & NOT_ASKED
    const recRepRes = await request(app)
      .get(`/api/v1/interview-sessions/${session.sessionId}/report`)
      .set(RECRUITER_A);
    assert.strictEqual(recRepRes.status, 200);
    const recRep = recRepRes.body.data.report;
    assert.strictEqual(recRep.overallAssessment.overallScore, 4.4); // 4*0.6 + 5*0.4 = 4.4
    assert.strictEqual(recRep.questionResults[2].evaluationStatus, 'NOT_ASKED');
    assert.strictEqual(recRep.questionResults[2].rating, null);

    // Candidate cannot access another candidate's report (IDOR)
    const idorRes = await request(app)
      .get(`/api/v1/interview-sessions/${session.sessionId}/report`)
      .set(CANDIDATE_B);
    assert.strictEqual(idorRes.status, 403);
  });

  it('rejects hallucinated evidence, supports partial crash recovery, human overrides, and RBAC', async () => {
    const { session } = await seedCompletedInterview();

    // Request evaluation via API twice -> idempotent deduplication
    const req1 = await request(app)
      .post(`/api/v1/interview-sessions/${session.sessionId}/evaluation`)
      .set(CANDIDATE_A)
      .send({});
    assert.strictEqual(req1.status, 202);

    const req2 = await request(app)
      .post(`/api/v1/interview-sessions/${session.sessionId}/evaluation`)
      .set(CANDIDATE_A)
      .send({});
    assert.strictEqual(req2.status, 200);
    assert.strictEqual(req2.body.data.deduplicated, true);

    // Simulate partial crash recovery: pre-seed q_node_1 evaluation so worker skips LLM for it
    await QuestionEvaluation.create({
      evaluationRunId: req1.body.data.evaluationRunId,
      sessionId: session._id,
      questionId: 'q_node_1',
      competencyId: 'comp_node',
      evaluationStatus: 'EVALUATED',
      rating: 4,
      ratingLabel: 'STRONG',
      evidenceSupport: 'HIGH',
    });

    const job = await jobRepo.claimNextJob({ workerId: 'test-w2', leaseMs: 60000 });
    const fakeHallucinatingLlm = {
      generateStructuredJson: async () => {
        llmCallCount += 1;
        return {
          provider: 'fake',
          model: 'fake-gemini',
          data: {
            rating: 5,
            criterionEvaluations: [],
            evidenceReferences: [
              { turnId: '000000000000000000000000', quote: 'Fabricated quote never spoken' },
            ],
            strengths: [],
            developmentAreas: ['Missing verified evidence'],
            missingEvidence: ['No valid quote'],
            explanation: 'Hallucinated evidence test.',
          },
        };
      },
    };

    await processEvaluationJob(job, { llmProvider: fakeHallucinatingLlm });
    assert.strictEqual(llmCallCount, 1); // Only q_db_1 called LLM; q_node_1 preserved!

    const qDb1 = await QuestionEvaluation.findOne({
      evaluationRunId: req1.body.data.evaluationRunId,
      questionId: 'q_db_1',
    });
    assert.strictEqual(qDb1.evaluationStatus, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(qDb1.rating, null); // Never awards credit for hallucinated quote

    // Candidate cannot submit human review (403)
    const candReview = await request(app)
      .post(`/api/v1/interview-evaluations/${req1.body.data.evaluationRunId}/reviews`)
      .set(CANDIDATE_A)
      .send({
        targetType: 'QUESTION',
        targetId: 'q_node_1',
        reviewAction: 'ADJUST_SCORE',
        revisedScore: 5,
        justification: 'Trying to boost own score',
      });
    assert.strictEqual(candReview.status, 403);

    // Recruiter submits human score adjustment -> original rating=4 preserved!
    const recReview = await request(app)
      .post(`/api/v1/interview-evaluations/${req1.body.data.evaluationRunId}/reviews`)
      .set(RECRUITER_A)
      .send({
        targetType: 'QUESTION',
        targetId: 'q_node_1',
        reviewAction: 'ADJUST_SCORE',
        revisedScore: 5,
        justification: 'Verified depth in audio review.',
      });
    assert.strictEqual(recReview.status, 201);
    assert.strictEqual(recReview.body.data.reviewEvent.originalScore, 4);
    assert.strictEqual(recReview.body.data.reviewEvent.revisedScore, 5);

    const preservedQ = await QuestionEvaluation.findOne({
      evaluationRunId: req1.body.data.evaluationRunId,
      questionId: 'q_node_1',
    });
    assert.strictEqual(preservedQ.rating, 4);
    assert.strictEqual(preservedQ.humanOverride.revisedScore, 5);
  });
});
