const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const app = require('../app');
const env = require('../config/env');
const { CandidateProfile } = require('../modules/candidate/candidateProfile.model');
const { InterviewIntake } = require('../modules/intake/interviewIntake.model');
const {
  CandidateRequirementAssessment,
} = require('../modules/candidate-intelligence/analysis/candidateRequirementAssessment.model');
const {
  InterviewBlueprint,
} = require('../modules/interview-blueprint/models/interviewBlueprint.model');
const InterviewSession = require('../modules/interview-orchestrator/session/interviewSession.model');
const InterviewTurn = require('../modules/interview-orchestrator/turns/interviewTurn.model');
const {
  InterviewEvaluationRun,
} = require('../modules/interview-evaluation/models/interviewEvaluationRun.model');
const {
  QuestionEvaluation,
} = require('../modules/interview-evaluation/models/questionEvaluation.model');
const {
  CompetencyEvaluation,
} = require('../modules/interview-evaluation/models/competencyEvaluation.model');
const {
  EvaluationReviewEvent,
} = require('../modules/interview-evaluation/models/evaluationReviewEvent.model');
const {
  RecruiterDecisionRecord,
} = require('../modules/decision-intelligence/decisions/recruiterDecisionRecord.model');
const {
  DecisionIntelligenceJob,
} = require('../modules/decision-intelligence/jobs/decisionIntelligenceJob.model');
const {
  processDecisionIntelligenceJob,
} = require('../modules/decision-intelligence/jobs/decision-intelligence.worker');

let replSet;

const STUDENT_A = { 'x-test-user-id': 'student_a' };
const STUDENT_B = { 'x-test-user-id': 'student_b' };
const INTERNAL_ADMIN = {
  'x-test-user-id': 'internal_admin_1',
  'x-test-org-id': 'org_platform',
  'x-test-org-role': 'org:admin',
};

const FAKE_LLM_PROVIDER = {
  generateStructuredJson: async ({ requestId }) => {
    if (String(requestId || '').startsWith('dev_plan_')) {
      return {
        provider: 'fake-gemini',
        model: 'gemini-fake-test',
        data: {
          summary: 'Practise caching invalidation trade-offs with concrete scenarios.',
          overallObjective: 'Strengthen backend interview readiness',
          objectives: [
            {
              objectiveId: 'obj_redis_1',
              competencyId: 'comp_redis',
              competency: 'Redis Caching',
              currentAssessment: 'PARTIALLY_DEMONSTRATED',
              developmentArea: 'Cache invalidation strategies',
              currentEvidence: 'Covered basic TTL usage (2.5/5).',
              targetLearningOutcome: 'Explain TTL, write-through, and cache-aside trade-offs.',
              recommendedTopics: ['Cache-aside pattern', 'Thundering herd mitigation'],
              practicalExercises: [
                {
                  title: 'Design a cache invalidation flow',
                  description: 'Write a short design note comparing TTL-only vs event-driven invalidation.',
                  successCriteria: ['Articulate two invalidation failure modes clearly'],
                },
              ],
              practiceQuestions: ['How do you prevent cache stampedes?'],
              completionCriteria: ['Explain two invalidation failure modes clearly.'],
              suggestedPriority: 'HIGH',
              estimatedEffort: '3-4 hours',
              sourceEvaluationReferences: ['q_redis_1'],
            },
          ],
        },
      };
    }
    if (String(requestId || '').startsWith('ans_improve_')) {
      return {
        provider: 'fake-gemini',
        model: 'gemini-fake-test',
        data: {
          items: [
            {
              questionId: 'q_redis_1',
              whatWasGood: ['Mentioned 5-minute TTL for session caching'],
              whatWasMissing: ['Cache invalidation strategies under write contention'],
              structureSuggestions: ['Define cache-aside, explain invalidation trade-offs, give an example.'],
              keyConceptsToMention: ['TTL', 'Write-through', 'Cache stampede'],
              betterAnswerOutline: [
                'State why Redis is used for session state',
                'Explain TTL vs explicit invalidation on writes',
              ],
              illustrativeExampleAnswer:
                'Illustrative approach: Use TTL as a safety net alongside explicit key invalidation on session mutation to avoid stale reads.',
              whyStronger: 'Connects caching strategy directly to consistency and failure modes.',
            },
          ],
        },
      };
    }
    return {
      provider: 'fake-gemini',
      model: 'gemini-fake-test',
      data: {
        coachingSummary:
          'You demonstrated strong Node.js fundamentals and can deepen Redis caching trade-offs next.',
      },
    };
  },
};

const seedEvaluatedSession = async ({
  userId = 'student_a',
  organizationId = null,
  targetRole = 'Backend Node.js Engineer',
  practiceMode = 'REALISTIC_MOCK',
  evaluatorVersion = '6.0.0',
  nodeScore = 4,
  redisScore = 2.5,
  sessionUuid = `sess_${crypto.randomBytes(4).toString('hex')}`,
} = {}) => {
  let profile = await CandidateProfile.findOne({ userId });
  if (!profile) {
    profile = await CandidateProfile.create({
      userId,
      fullName: 'Asha Student',
      email: `${userId}@example.com`,
      totalExperienceMonths: 12,
      experienceLevel: 'MID',
    });
  }

  const intake = await InterviewIntake.create({
    userId,
    candidateProfileId: profile._id,
    targetJobProfileId: new mongoose.Types.ObjectId(),
    status: 'COMPLETED',
  });

  const analysisId = new mongoose.Types.ObjectId();
  await CandidateRequirementAssessment.insertMany([
    {
      analysisId,
      intakeId: intake._id,
      userId,
      requirementId: 'req_node',
      requirementName: 'Node.js Event Loop',
      requirementCategory: 'TECHNICAL',
      requirementType: 'MUST_HAVE',
      assessment: 'SUPPORTED_DIRECTLY',
      explanation: 'Node.js project listed on resume.',
    },
    {
      analysisId,
      intakeId: intake._id,
      userId,
      requirementId: 'req_redis',
      requirementName: 'Redis Caching',
      requirementCategory: 'TECHNICAL',
      requirementType: 'MUST_HAVE',
      assessment: 'PARTIALLY_SUPPORTED',
      explanation: 'Caching mentioned briefly.',
    },
  ]);

  const blueprint = await InterviewBlueprint.create({
    intakeId: intake._id,
    userId,
    candidateProfileId: profile._id,
    candidateAnalysisId: analysisId,
    targetRole,
    blueprintVersion: 1,
    status: 'READY',
    totalDurationSeconds: 1800,
    competencyPlan: [
      { competencyId: 'comp_node', competencyName: 'Node.js Runtime', sourceRequirementIds: ['req_node'], weight: 0.5 },
      { competencyId: 'comp_redis', competencyName: 'Redis Caching', sourceRequirementIds: ['req_redis'], weight: 0.5 },
    ],
    questionPlan: [
      { questionId: 'q_node_1', competencyId: 'comp_node', weight: 1 },
      { questionId: 'q_redis_1', competencyId: 'comp_redis', weight: 1 },
    ],
  });

  const session = await InterviewSession.create({
    sessionId: sessionUuid,
    userId,
    organizationId,
    candidateProfileId: profile._id,
    intakeId: intake._id,
    candidateAnalysisId: analysisId,
    blueprintId: blueprint._id,
    blueprintVersion: 1,
    blueprintChecksum: 'chk_test_1',
    targetRole,
    interviewType: 'MIXED',
    practiceMode,
    seniorityLevel: 'MID',
    totalDurationSeconds: 1800,
    status: 'COMPLETED',
    overallScore: (nodeScore + redisScore) / 2,
  });

  const turnNode = await InterviewTurn.create({
    sessionId: session._id,
    turnNumber: 1,
    idempotencyKey: `${sessionUuid}_t1`,
    speaker: 'CANDIDATE',
    turnType: 'CANDIDATE_ANSWER',
    questionId: 'q_node_1',
    competencyId: 'comp_node',
    spokenText: 'The Node.js event loop processes timers, pending callbacks, poll, check, and close callbacks.',
    rawTranscript: 'The Node.js event loop processes timers, pending callbacks, poll, check, and close callbacks.',
  });

  const turnRedis = await InterviewTurn.create({
    sessionId: session._id,
    turnNumber: 2,
    idempotencyKey: `${sessionUuid}_t2`,
    speaker: 'CANDIDATE',
    turnType: 'CANDIDATE_ANSWER',
    questionId: 'q_redis_1',
    competencyId: 'comp_redis',
    spokenText: 'We used Redis with a 5-minute TTL for user session caching.',
    rawTranscript: 'We used Redis with a 5-minute TTL for user session caching.',
  });

  const evaluationRun = await InterviewEvaluationRun.create({
    sessionId: session._id,
    sessionUuid,
    intakeId: intake._id,
    candidateProfileId: profile._id,
    userId,
    blueprintId: blueprint._id,
    blueprintVersion: 1,
    evaluationVersion: 1,
    evaluatorVersion,
    sessionSnapshotChecksum: `snap_${sessionUuid}`,
    idempotencyKey: `eval_${sessionUuid}_v1`,
    status: 'COMPLETED',
    overallScore: (nodeScore + redisScore) / 2,
    coverageSummary: {
      totalPlannedQuestions: 2,
      evaluatedQuestions: 2,
      assessmentCoverage: 100,
    },
  });

  await QuestionEvaluation.insertMany([
    {
      evaluationRunId: evaluationRun._id,
      sessionId: session._id,
      questionId: 'q_node_1',
      competencyId: 'comp_node',
      questionType: 'TECHNICAL',
      questionText: 'Explain the phases of the Node.js event loop.',
      evaluationStatus: 'EVALUATED',
      rating: nodeScore,
      evidenceSupport: 'HIGH',
      evidenceReferences: [{ turnId: turnNode._id, snippet: 'event loop processes timers' }],
    },
    {
      evaluationRunId: evaluationRun._id,
      sessionId: session._id,
      questionId: 'q_redis_1',
      competencyId: 'comp_redis',
      questionType: 'TECHNICAL',
      questionText: 'How would you design Redis session caching and invalidation?',
      evaluationStatus: 'EVALUATED',
      rating: redisScore,
      evidenceSupport: 'MEDIUM',
      missingEvidence: ['Cache invalidation strategies under write contention'],
      evidenceReferences: [{ turnId: turnRedis._id, snippet: '5-minute TTL for user session caching' }],
    },
  ]);

  await CompetencyEvaluation.insertMany([
    {
      evaluationRunId: evaluationRun._id,
      competencyId: 'comp_node',
      competencyName: 'Node.js Runtime',
      assessmentStatus: 'ASSESSED',
      score: nodeScore,
      evidenceSupport: 'HIGH',
      strengths: ['Accurate phase explanation'],
      evidenceReferences: [{ turnId: turnNode._id, snippet: 'event loop processes timers' }],
    },
    {
      evaluationRunId: evaluationRun._id,
      competencyId: 'comp_redis',
      competencyName: 'Redis Caching',
      assessmentStatus: 'ASSESSED',
      score: redisScore,
      evidenceSupport: 'MEDIUM',
      developmentAreas: ['Cache invalidation strategies'],
      evidenceReferences: [{ turnId: turnRedis._id, snippet: '5-minute TTL for user session caching' }],
    },
  ]);

  return { session, evaluationRun, profile, intake };
};

test.before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

test('Module 7 integration: student learning insights, answer guidance, dedup, human-review v2, and ownership isolation', async () => {
  const { session, evaluationRun } = await seedEvaluatedSession();

  // Student B blocked from Student A's session
  const idorGen = await request(app)
    .post(`/api/v1/interview-sessions/${session.sessionId}/learning-insights/generate`)
    .set(STUDENT_B)
    .send({});
  assert.equal(idorGen.status, 403);

  // Student A generates learning insights
  const enq1 = await request(app)
    .post(`/api/v1/interview-sessions/${session.sessionId}/learning-insights/generate`)
    .set(STUDENT_A)
    .send({});
  assert.equal(enq1.status, 202);
  assert.ok(enq1.body.data.jobId);

  const job1 = await DecisionIntelligenceJob.findById(enq1.body.data.jobId);
  const ok1 = await processDecisionIntelligenceJob(job1, { llmProvider: FAKE_LLM_PROVIDER });
  assert.equal(ok1, true);

  // Student A retrieves learning insights
  const insightsRes = await request(app)
    .get(`/api/v1/interview-sessions/${session.sessionId}/learning-insights`)
    .set(STUDENT_A);
  assert.equal(insightsRes.status, 200);
  assert.equal(insightsRes.body.data.reportVersion, 1);
  assert.equal(insightsRes.body.data.reportStatus, 'MIXED_PRACTICE_EVIDENCE');
  assert.equal(insightsRes.body.data.preparationCoverage.length, 2);
  assert.equal('decisionSupportStatus' in insightsRes.body.data, false);

  // Student A retrieves answer improvement guidance
  const ansRes = await request(app)
    .get(`/api/v1/interview-sessions/${session.sessionId}/learning-insights/answers`)
    .set(STUDENT_A);
  assert.equal(ansRes.status, 200);
  assert.equal(ansRes.body.data.answers.length, 1);
  assert.equal(ansRes.body.data.answers[0].questionId, 'q_redis_1');

  // Student B blocked from GET
  const idorGet = await request(app)
    .get(`/api/v1/interview-sessions/${session.sessionId}/learning-insights`)
    .set(STUDENT_B);
  assert.equal(idorGet.status, 403);

  // Deduplication check
  const dedupRes = await request(app)
    .post(`/api/v1/interview-sessions/${session.sessionId}/learning-insights/generate`)
    .set(STUDENT_A)
    .send({});
  assert.equal(dedupRes.status, 200);
  assert.equal(dedupRes.body.data.deduplicated, true);

  // Review version increment -> report v2
  await InterviewEvaluationRun.updateOne(
    { _id: evaluationRun._id },
    { $set: { reviewStatus: 'REVIEW_IN_PROGRESS', latestReviewVersion: 1 } }
  );
  const enq2 = await request(app)
    .post(`/api/v1/interview-sessions/${session.sessionId}/learning-insights/generate`)
    .set(STUDENT_A)
    .send({});
  assert.equal(enq2.status, 202);
  const job2 = await DecisionIntelligenceJob.findById(enq2.body.data.jobId);
  await processDecisionIntelligenceJob(job2, { llmProvider: FAKE_LLM_PROVIDER });

  const v2Res = await request(app)
    .get(`/api/v1/interview-sessions/${session.sessionId}/learning-insights`)
    .set(STUDENT_A);
  assert.equal(v2Res.status, 200);
  assert.equal(v2Res.body.data.reportVersion, 2);
});

test('Module 7 integration: personalised development plan, progress tracking, and longitudinal comparable trends', async () => {
  const { session: s1 } = await seedEvaluatedSession({
    userId: 'student_longitudinal',
    practiceMode: 'REALISTIC_MOCK',
    redisScore: 2.0,
  });
  const { session: s2 } = await seedEvaluatedSession({
    userId: 'student_longitudinal',
    practiceMode: 'REALISTIC_MOCK',
    redisScore: 3.5,
  });
  // Guided practice session should NOT be compared directly with REALISTIC_MOCK
  const { session: sGuided } = await seedEvaluatedSession({
    userId: 'student_longitudinal',
    practiceMode: 'GUIDED_PRACTICE',
    redisScore: 4.5,
  });

  for (const s of [s1, s2, sGuided]) {
    const enq = await request(app)
      .post(`/api/v1/interview-sessions/${s.sessionId}/learning-insights/generate`)
      .set({ 'x-test-user-id': 'student_longitudinal' })
      .send({});
    const job = await DecisionIntelligenceJob.findById(enq.body.data.jobId);
    await processDecisionIntelligenceJob(job, { llmProvider: FAKE_LLM_PROVIDER });
  }

  // Practice history
  const histRes = await request(app)
    .get('/api/v1/candidates/me/practice-history')
    .set({ 'x-test-user-id': 'student_longitudinal' });
  assert.equal(histRes.status, 200);
  assert.equal(histRes.body.data.totalAttempts, 3);

  // Competency progress separates REALISTIC_MOCK (2 attempts: 40% -> 70%, IMPROVING) from GUIDED_PRACTICE (1 attempt: BASELINE_ONLY)
  const progRes = await request(app)
    .get('/api/v1/candidates/me/competency-progress')
    .set({ 'x-test-user-id': 'student_longitudinal' });
  assert.equal(progRes.status, 200);
  const redisRealistic = progRes.body.data.competencyTrends.find(
    (t) => t.competencyId === 'comp_redis' && t.practiceMode === 'REALISTIC_MOCK'
  );
  const redisGuided = progRes.body.data.competencyTrends.find(
    (t) => t.competencyId === 'comp_redis' && t.practiceMode === 'GUIDED_PRACTICE'
  );
  assert.equal(redisRealistic.comparableAttemptCount, 2);
  assert.equal(redisRealistic.deltaPercent, 30);
  assert.equal(redisRealistic.trend, 'IMPROVING');
  assert.equal(redisGuided.comparableAttemptCount, 1);
  assert.equal(redisGuided.trend, 'BASELINE_ONLY');

  // Development plan & progress tracking
  const dpEnq = await request(app)
    .post(`/api/v1/interview-sessions/${s1.sessionId}/development-plan/generate`)
    .set({ 'x-test-user-id': 'student_longitudinal' })
    .send({});
  assert.equal(dpEnq.status, 202);
  const dpJob = await DecisionIntelligenceJob.findById(dpEnq.body.data.jobId);
  await processDecisionIntelligenceJob(dpJob, { llmProvider: FAKE_LLM_PROVIDER });

  const dpGet = await request(app)
    .get(`/api/v1/interview-sessions/${s1.sessionId}/development-plan`)
    .set({ 'x-test-user-id': 'student_longitudinal' });
  assert.equal(dpGet.status, 200);
  const plan = dpGet.body.data;
  const objId = plan.objectives[0].objectiveId;

  const upd = await request(app)
    .post(`/api/v1/development-plans/${plan._id}/objectives/${objId}/progress`)
    .set({ 'x-test-user-id': 'student_longitudinal' })
    .send({ action: 'COMPLETED', candidateNotes: 'Practised cache stampede mitigation' });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.data.progressEvent.progressStatus, 'COMPLETED');

  // Student B cannot read student_longitudinal's plan progress
  const idorProg = await request(app)
    .get(`/api/v1/development-plans/${plan._id}/progress`)
    .set(STUDENT_B);
  assert.equal(idorProg.status, 403);
});

test('Module 7 integration: deprecation of recruiter routes, historical record preservation, internal quality & calibration isolation', async () => {
  const { session, evaluationRun, profile, intake } = await seedEvaluatedSession({
    userId: 'student_sec',
    organizationId: 'org_platform',
  });

  // Historical RecruiterDecisionRecord remains preserved in DB
  await RecruiterDecisionRecord.create({
    organizationId: 'org_platform',
    candidateProfileId: profile._id,
    intakeId: intake._id,
    sessionId: session._id,
    recruiterId: 'legacy_rec_1',
    evaluationRunId: evaluationRun._id,
    decision: 'ADVANCE',
    justification: 'Historical pre-refactor record',
    decisionVersion: 1,
  });
  const preservedCount = await RecruiterDecisionRecord.countDocuments({ sessionId: session._id });
  assert.equal(preservedCount, 1);

  // Deprecated recruiter hiring routes are removed from active student product API
  const legacyDecisionPost = await request(app)
    .post(`/api/v1/interview-sessions/${session.sessionId}/recruiter-decisions`)
    .set(INTERNAL_ADMIN)
    .send({ decision: 'ADVANCE', justification: 'Should be removed' });
  assert.equal(legacyDecisionPost.status, 404);

  const legacyDsGet = await request(app)
    .get(`/api/v1/interview-sessions/${session.sessionId}/decision-support`)
    .set(INTERNAL_ADMIN);
  assert.equal(legacyDsGet.status, 404);

  // Generate student insights so internal quality & calibration records are created
  await EvaluationReviewEvent.create({
    evaluationRunId: evaluationRun._id,
    reviewerId: 'internal_admin_1',
    targetType: 'QUESTION',
    targetId: 'q_node_1',
    originalScore: 4,
    revisedScore: 4.5,
    reviewAction: 'ADJUST_SCORE',
    justification: 'Internal calibration check',
    reviewVersion: 1,
  });

  const enq = await request(app)
    .post(`/api/v1/interview-sessions/${session.sessionId}/learning-insights/generate`)
    .set({ 'x-test-user-id': 'student_sec' })
    .send({});
  const job = await DecisionIntelligenceJob.findById(enq.body.data.jobId);
  await processDecisionIntelligenceJob(job, { llmProvider: FAKE_LLM_PROVIDER });

  // Unauthenticated CANNOT access internal endpoints (401)
  const unauthQuality = await request(app)
    .get(`/api/v1/internal/evaluation-quality/sessions/${session.sessionId}`);
  assert.equal(unauthQuality.status, 401);

  // Student CANNOT access internal quality report or internal calibration (403)
  const studentQuality = await request(app)
    .get(`/api/v1/internal/evaluation-quality/sessions/${session.sessionId}`)
    .set({ 'x-test-user-id': 'student_sec' });
  assert.equal(studentQuality.status, 403);

  const studentCal = await request(app)
    .get('/api/v1/internal/evaluation-calibration/org_platform')
    .set({ 'x-test-user-id': 'student_sec' });
  assert.equal(studentCal.status, 403);

  // Recruiter without platform-admin permission CANNOT access internal endpoints (403)
  const recruiterQuality = await request(app)
    .get(`/api/v1/internal/evaluation-quality/sessions/${session.sessionId}`)
    .set(INTERNAL_ADMIN); // org:admin is recruiter-level, NOT platform_admin
  assert.equal(recruiterQuality.status, 403);

  const PLATFORM_ADMIN = {
    'x-test-user-id': 'platform_admin_1',
    'x-test-org-id': 'org_platform',
    'x-test-org-role': 'org:platform_admin',
  };
  const CROSS_ORG_PLATFORM_ADMIN = {
    'x-test-user-id': 'platform_admin_2',
    'x-test-org-id': 'org_other',
    'x-test-org-role': 'org:platform_admin',
  };

  // Cross-org platform admin blocked from org_platform calibration (403)
  const crossOrgCal = await request(app)
    .get('/api/v1/internal/evaluation-calibration/org_platform')
    .set(CROSS_ORG_PLATFORM_ADMIN);
  assert.equal(crossOrgCal.status, 403);

  // Verified platform admin CAN access internal quality report and calibration (suppressed below minSamples)
  const adminQuality = await request(app)
    .get(`/api/v1/internal/evaluation-quality/sessions/${session.sessionId}`)
    .set(PLATFORM_ADMIN);
  assert.equal(adminQuality.status, 200);
  assert.equal(adminQuality.body.data.qualityStatus, 'PASSED');

  const adminCal = await request(app)
    .get('/api/v1/internal/evaluation-calibration/org_platform')
    .set(PLATFORM_ADMIN);
  assert.equal(adminCal.status, 200);
  assert.equal(adminCal.body.data.belowMinimumSampleThreshold, true);
  assert.equal(
    adminCal.body.data.minimumRequiredSamples,
    env.DECISION_INTELLIGENCE_CALIBRATION_MIN_SAMPLES
  );

  // Timing-safe internal service token works when configured; invalid token is rejected (403)
  const prevSecret = env.PLATFORM_ADMIN_SECRET;
  env.PLATFORM_ADMIN_SECRET = 'test-platform-secret-xyz';
  try {
    const badTok = await request(app)
      .get(`/api/v1/internal/evaluation-quality/sessions/${session.sessionId}`)
      .set({ 'x-internal-platform-token': 'wrong' });
    assert.equal(badTok.status, 403);

    const goodTok = await request(app)
      .get(`/api/v1/internal/evaluation-quality/sessions/${session.sessionId}`)
      .set({ 'x-internal-platform-token': 'test-platform-secret-xyz' });
    assert.equal(goodTok.status, 200);
  } finally {
    env.PLATFORM_ADMIN_SECRET = prevSecret;
  }

  // Guided & Focused practice modes never silently fall back to ordinary REALISTIC_MOCK
  const guidedModeRes = await request(app)
    .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
    .set({ 'x-test-user-id': 'student_sec' })
    .send({ practiceMode: 'GUIDED_PRACTICE' });
  assert.equal(guidedModeRes.status, 201);
  assert.equal(guidedModeRes.body.data.practiceMode, 'GUIDED_PRACTICE');

  const focusedWithoutCompRes = await request(app)
    .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
    .set({ 'x-test-user-id': 'student_sec' })
    .send({ practiceMode: 'FOCUSED_SKILL_PRACTICE' });
  assert.equal(focusedWithoutCompRes.status, 400);
});
