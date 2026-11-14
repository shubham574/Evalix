const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

const app = require('../app');
const { CandidateProfile } = require('../modules/candidate/candidateProfile.model');
const { TargetJobProfile } = require('../modules/job-profile/targetJobProfile.model');
const { InterviewIntake } = require('../modules/intake/interviewIntake.model');
const { CandidateJobAnalysis } = require('../modules/candidate-intelligence/analysis/candidateJobAnalysis.model');
const { InterviewBlueprint } = require('../modules/interview-blueprint/models/interviewBlueprint.model');
const InterviewSession = require('../modules/interview-orchestrator/session/interviewSession.model');
const InterviewTurn = require('../modules/interview-orchestrator/turns/interviewTurn.model');
const InterviewEvent = require('../modules/interview-orchestrator/events/interviewEvent.model');
const SessionMemory = require('../modules/interview-orchestrator/memory/sessionMemory.model');
const PracticeAttempt = require('../modules/interview-orchestrator/practice/practiceAttempt.model');
const { PracticeHint } = require('../modules/interview-orchestrator/practice/practiceHint.model');
const { InterviewEvaluationRun } = require('../modules/interview-evaluation/models/interviewEvaluationRun.model');
const { QuestionEvaluation } = require('../modules/interview-evaluation/models/questionEvaluation.model');
const { CompetencyEvaluation } = require('../modules/interview-evaluation/models/competencyEvaluation.model');
const { InterviewReport } = require('../modules/interview-evaluation/models/interviewReport.model');
const { InterviewEvaluationJob } = require('../modules/interview-evaluation/models/interviewEvaluationJob.model');
const {
  createEvaluationRunAndJob,
} = require('../modules/interview-evaluation/interview-evaluation.service');
const {
  processEvaluationJob,
} = require('../modules/interview-evaluation/jobs/evaluation.worker');
const controller = require('../modules/interview-orchestrator/interview-orchestrator.controller');
const {
  createInterviewRuntimeService,
} = require('../modules/interview-orchestrator/runtime/interview-runtime.service');

const USER_A = { 'x-test-user-id': 'user_m8_a', 'x-test-email': 'a8@evalix.dev' };
const USER_B = { 'x-test-user-id': 'user_m8_b', 'x-test-email': 'b8@evalix.dev' };

let replSet;

const seedReadyBlueprint = async ({ userId = 'user_m8_a' } = {}) => {
  let candidate = await CandidateProfile.findOne({ userId });
  if (!candidate) {
    candidate = await CandidateProfile.create({
      userId,
      fullName: 'Shubham Maurya',
      email: 'shubham8@evalix.dev',
      phone: '+91-9999900008',
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
    interviewPreferences: {
      interviewType: 'TECHNICAL',
      durationMinutes: 30,
      difficulty: 'ADAPTIVE',
    },
    status: 'READY_FOR_ANALYSIS',
    submittedAt: new Date(),
  });
  const analysis = await CandidateJobAnalysis.create({
    intakeId: intake._id,
    candidateProfileId: candidate._id,
    targetJobProfileId: jobProfile._id,
    userId,
    resumeExtractionId: new mongoose.Types.ObjectId(),
    jobDescriptionExtractionId: new mongoose.Types.ObjectId(),
    analysisVersion: 1,
    analysisStatus: 'READY_FOR_INTERVIEW_PLANNING',
  });

  const blueprint = await InterviewBlueprint.create({
    intakeId: intake._id,
    candidateProfileId: candidate._id,
    targetJobProfileId: jobProfile._id,
    candidateAnalysisId: analysis._id,
    userId,
    blueprintVersion: 1,
    status: 'READY',
    interviewType: 'TECHNICAL',
    targetRole: 'Backend Node.js Engineer',
    seniorityLevel: 'MID',
    totalDurationSeconds: 1800,
    competencyPlan: [
      {
        competencyId: 'comp_node',
        name: 'Node.js Runtime',
        weight: 0.6,
        targetDepth: 'DEEP',
        rationale: 'Core backend runtime skill',
      },
      {
        competencyId: 'comp_db',
        name: 'Database Design',
        weight: 0.4,
        targetDepth: 'MEDIUM',
        rationale: 'Core persistence skill',
      },
    ],
    stages: [
      {
        stageId: 'stg_node',
        stageType: 'CORE_TECHNICAL',
        stageName: 'Node.js Deep Dive',
        durationSeconds: 900,
        order: 1,
      },
      {
        stageId: 'stg_db',
        stageType: 'CORE_TECHNICAL',
        stageName: 'Database Design',
        durationSeconds: 900,
        order: 2,
      },
    ],
    questionPlan: [
      {
        questionId: 'q_node_1',
        stageId: 'stg_node',
        competencyId: 'comp_node',
        questionType: 'TECHNICAL',
        prompt: 'Explain how the Node.js event loop schedules timers vs I/O callbacks.',
        weight: 0.6,
        expectedEvidence: ['Libuv phases', 'Microtask queue'],
        evaluationRubricId: 'rub_node_1',
        maxFollowUps: 1,
      },
      {
        questionId: 'q_db_1',
        stageId: 'stg_db',
        competencyId: 'comp_db',
        questionType: 'TECHNICAL',
        prompt: 'How do you design a compound index for multi-tenant queries?',
        weight: 0.4,
        expectedEvidence: ['Equality-Sort-Range rule', 'Selectivity'],
        evaluationRubricId: 'rub_db_1',
        maxFollowUps: 1,
      },
    ],
    evaluationRubrics: [
      {
        rubricId: 'rub_node_1',
        questionId: 'q_node_1',
        competencyId: 'comp_node',
        ratingScale: '1-5',
        ratingDescriptors: [1, 2, 3, 4, 5].map((r) => ({
          rating: r,
          label: `Level ${r}`,
          descriptor: `Descriptor for level ${r}`,
        })),
        expectedEvidence: ['Libuv phases', 'Microtask queue'],
        criteria: [{ criterionId: 'crit_1', criterion: 'Event loop phases', weight: 1 }],
      },
      {
        rubricId: 'rub_db_1',
        questionId: 'q_db_1',
        competencyId: 'comp_db',
        ratingScale: '1-5',
        ratingDescriptors: [1, 2, 3, 4, 5].map((r) => ({
          rating: r,
          label: `Level ${r}`,
          descriptor: `Descriptor for level ${r}`,
        })),
        expectedEvidence: ['Equality-Sort-Range rule', 'Selectivity'],
        criteria: [{ criterionId: 'crit_db', criterion: 'Index selectivity', weight: 1 }],
      },
    ],
  });

  return { intake, blueprint };
};

const fakeTts = {
  synthesizeSpeech: async ({ text }) => ({
    ok: true,
    fallbackToBrowser: false,
    mimeType: 'audio/mpeg',
    audioBase64: Buffer.from(`tts:${text.slice(0, 12)}`).toString('base64'),
  }),
};

const fakeStt = {
  resolveCandidateInput: async ({ audioBuffer, transcriptText, transcriptStatus }) => {
    if (transcriptStatus === 'PARTIAL') {
      return {
        ignoredForDecision: true,
        reason: 'PARTIAL_TRANSCRIPT_IGNORED',
        emptyTranscript: false,
        transcript: '',
        transcriptStatus: 'PARTIAL',
      };
    }
    const resolved =
      String(transcriptText || '').trim() ||
      (audioBuffer && audioBuffer.length > 0 ? 'Spoken answer transcribed from audio buffer.' : '');
    return {
      ignoredForDecision: false,
      emptyTranscript: !resolved,
      transcript: resolved,
      transcriptStatus: transcriptStatus || 'FINAL',
    };
  },
};

const fakeAgent = {
  decideNextTurn: async ({ nextQuestionCandidate }) => {
    if (nextQuestionCandidate) {
      return {
        action: 'MOVE_NEXT_QUESTION',
        spokenResponse: nextQuestionCandidate.prompt,
      };
    }
    return {
      action: 'END_INTERVIEW',
      spokenResponse: 'Thank you for completing this practice session.',
    };
  },
};

describe('Module 8 Integration Tests — Guided & Focused Skill Practice', () => {
  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    controller.setRuntimeService(
      createInterviewRuntimeService({
        sttProvider: {
          transcribe: async () => ({
            transcript: 'Spoken answer transcribed from audio buffer.',
          }),
        },
        ttsProvider: {
          synthesize: async ({ text }) => ({
            ok: true,
            fallbackToBrowser: false,
            mimeType: 'audio/mpeg',
            audioBase64: Buffer.from(`tts:${String(text || '').slice(0, 12)}`).toString('base64'),
          }),
        },
      })
    );
  });

  after(async () => {
    controller.setRuntimeService(null);
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      CandidateProfile.deleteMany({}),
      TargetJobProfile.deleteMany({}),
      InterviewIntake.deleteMany({}),
      CandidateJobAnalysis.deleteMany({}),
      InterviewBlueprint.deleteMany({}),
      InterviewSession.deleteMany({}),
      InterviewTurn.deleteMany({}),
      InterviewEvent.deleteMany({}),
      SessionMemory.deleteMany({}),
      PracticeAttempt.deleteMany({}),
      PracticeHint.deleteMany({}),
      InterviewEvaluationRun.deleteMany({}),
      QuestionEvaluation.deleteMany({}),
      CompetencyEvaluation.deleteMany({}),
      InterviewReport.deleteMany({}),
      InterviewEvaluationJob.deleteMany({}),
    ]);
  });

  it('GUIDED_PRACTICE supports progressive hints, retries, feedback, idempotency, ownership, and single selected attempt in turn ledger', async () => {
    const { intake } = await seedReadyBlueprint();

    const createRes = await request(app)
      .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
      .set(USER_A)
      .send({ practiceMode: 'GUIDED_PRACTICE' });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.data.practiceMode, 'GUIDED_PRACTICE');
    const sessionId = createRes.body.data.sessionId;

    const startRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/start`)
      .set(USER_A)
      .send({ consentGranted: true });
    assert.strictEqual(startRes.status, 200);
    assert.strictEqual(startRes.body.data.session.currentQuestionId, 'q_node_1');

    // Live /turns must be rejected in GUIDED_PRACTICE (no fallback to REALISTIC_MOCK)
    const liveTurnRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/turns`)
      .set(USER_A)
      .send({ idempotencyKey: 'live_1', transcriptText: 'Hello' });
    assert.strictEqual(liveTurnRes.status, 409);

    // Ownership check: USER_B cannot request hints or attempts
    const forbiddenHint = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/hint`)
      .set(USER_B)
      .send({ idempotencyKey: 'hint_b' });
    assert.strictEqual(forbiddenHint.status, 403);

    // Progressive hints 1..3 + idempotency + cap at 3
    const h1 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/hint`)
      .set(USER_A)
      .send({ idempotencyKey: 'hint_1' });
    assert.strictEqual(h1.status, 200);
    assert.strictEqual(h1.body.data.hint.hintLevel, 1);
    assert.strictEqual(h1.body.data.hint.hintType, 'LIGHT');

    const h1Replay = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/hint`)
      .set(USER_A)
      .send({ idempotencyKey: 'hint_1' });
    assert.strictEqual(h1Replay.status, 200);
    assert.strictEqual(h1Replay.body.data.idempotentReplay, true);

    const h2 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/hint`)
      .set(USER_A)
      .send({ idempotencyKey: 'hint_2' });
    assert.strictEqual(h2.body.data.hint.hintType, 'STRUCTURE');

    const h3 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/hint`)
      .set(USER_A)
      .send({ idempotencyKey: 'hint_3' });
    assert.strictEqual(h3.body.data.hint.hintType, 'CONCEPT');

    const h4 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/hint`)
      .set(USER_A)
      .send({ idempotencyKey: 'hint_4' });
    assert.strictEqual(h4.status, 409);

    // Submit Attempt 1 + idempotency + Retry + Attempt 2
    const a1 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/attempts`)
      .set(USER_A)
      .send({ idempotencyKey: 'att_1', answerText: 'Timers run in the timers phase.' });
    assert.strictEqual(a1.status, 200);
    assert.strictEqual(a1.body.data.attempt.attemptNumber, 1);
    assert.ok(a1.body.data.attempt.feedback.coachingSummary);

    const retryRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/retry`)
      .set(USER_A)
      .send({});
    assert.strictEqual(retryRes.status, 200);
    assert.strictEqual(retryRes.body.data.nextAttemptNumber, 2);

    const a2 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/attempts`)
      .set(USER_A)
      .send({
        idempotencyKey: 'att_2',
        answerText:
          'Libuv runs timers, pending callbacks, poll for I/O, check, and close callbacks, draining microtasks between phases.',
      });
    assert.strictEqual(a2.status, 200);
    assert.strictEqual(a2.body.data.attempt.attemptNumber, 2);

    // Feedback endpoint returns both append-only attempts + 3 hints
    const fbRes = await request(app)
      .get(`/api/v1/interview-sessions/${sessionId}/feedback`)
      .set(USER_A);
    assert.strictEqual(fbRes.status, 200);
    assert.strictEqual(fbRes.body.data.attempts.length, 2);
    assert.strictEqual(fbRes.body.data.hints.length, 3);

    // Continue to q_db_1 + idempotency check (must not advance twice)
    const cont1 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/continue`)
      .set(USER_A)
      .send({ idempotencyKey: 'cont_1' });
    assert.strictEqual(cont1.status, 200);
    assert.strictEqual(cont1.body.data.session.currentQuestionId, 'q_db_1');

    const cont1Replay = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/continue`)
      .set(USER_A)
      .send({ idempotencyKey: 'cont_1' });
    assert.strictEqual(cont1Replay.status, 200);
    assert.strictEqual(cont1Replay.body.data.idempotentReplay, true);
    assert.strictEqual(cont1Replay.body.data.session.currentQuestionId, 'q_db_1');

    // Answer q_db_1 and continue to complete session
    await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/attempts`)
      .set(USER_A)
      .send({
        idempotencyKey: 'att_db_1',
        answerText: 'Put tenant_id equality first, then sort column, then range predicates.',
      });

    const cont2 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/continue`)
      .set(USER_A)
      .send({ idempotencyKey: 'cont_2' });
    assert.strictEqual(cont2.status, 200);
    assert.strictEqual(cont2.body.data.completed, true);
    assert.strictEqual(cont2.body.data.session.status, 'COMPLETED');

    // Verify InterviewTurn has only 1 candidate turn per question (selected attempt 2 for q_node_1)
    const dbSession = await InterviewSession.findOne({ sessionId }).lean();
    const candidateTurns = await InterviewTurn.find({
      sessionId: dbSession._id,
      speaker: 'CANDIDATE',
    }).lean();
    assert.strictEqual(candidateTurns.length, 2);
    const nodeTurn = candidateTurns.find((t) => t.questionId === 'q_node_1');
    assert.ok(nodeTurn.spokenText.includes('Libuv runs timers'));
  });

  it('FOCUSED_SKILL_PRACTICE filters blueprint without mutating it and runs scoped Module 6 evaluation', async () => {
    const { intake, blueprint } = await seedReadyBlueprint();

    // Invalid competencyId rejected with 400 (never falls back to REALISTIC_MOCK)
    const badRes = await request(app)
      .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
      .set(USER_A)
      .send({ practiceMode: 'FOCUSED_SKILL_PRACTICE', competencyId: 'comp_missing' });
    assert.strictEqual(badRes.status, 400);

    // Valid focused session for comp_node
    const createRes = await request(app)
      .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
      .set(USER_A)
      .send({
        practiceMode: 'FOCUSED_SKILL_PRACTICE',
        competencyId: 'comp_node',
        maxQuestions: 1,
      });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.data.practiceMode, 'FOCUSED_SKILL_PRACTICE');
    assert.strictEqual(createRes.body.data.focusedCompetencyId, 'comp_node');
    assert.strictEqual(createRes.body.data.focusedPracticeSummary.plannedQuestionCount, 1);

    // Original locked blueprint remains untouched
    const reloadedBlueprint = await InterviewBlueprint.findById(blueprint._id).lean();
    assert.strictEqual(reloadedBlueprint.questionPlan.length, 2);
    assert.strictEqual(reloadedBlueprint.isLockedForSession, true);

    const sessionId = createRes.body.data.sessionId;
    await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/start`)
      .set(USER_A)
      .send({ consentGranted: true });

    const turnRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/turns`)
      .set(USER_A)
      .send({
        idempotencyKey: 'focused_t1',
        transcriptText: 'Libuv processes timers, poll phase for I/O, and check phase for setImmediate.',
      });
    assert.strictEqual(turnRes.status, 200);

    if (turnRes.body.data.session.status !== 'COMPLETED') {
      const endRes = await request(app)
        .post(`/api/v1/interview-sessions/${sessionId}/end`)
        .set(USER_A)
        .send({ reason: 'PRACTICE_COMPLETED' });
      assert.strictEqual(endRes.status, 200);
      assert.strictEqual(endRes.body.data.status, 'COMPLETED');
    }

    // Run Module 6 scoped evaluation with fake deterministic LLM
    const focusedSessionDoc = await InterviewSession.findOne({ sessionId }).lean();
    const candidateTurn = await InterviewTurn.findOne({
      sessionId: focusedSessionDoc._id,
      speaker: 'CANDIDATE',
    }).lean();

    const fakeEvalLlm = {
      generateStructuredJson: async () => ({
        provider: 'fake',
        model: 'fake-gemini',
        data: {
          rating: 4,
          criterionEvaluations: [{ criterionId: 'crit_1', status: 'DEMONSTRATED', comment: 'Clear' }],
          evidenceReferences: [
            {
              turnId: String(candidateTurn._id),
              quote: 'Libuv processes timers, poll phase for I/O, and check phase for setImmediate.',
            },
          ],
          strengths: ['Clear understanding of libuv phases'],
          developmentAreas: [],
          missingEvidence: [],
          explanation: 'Solid explanation of Node.js event loop.',
        },
      }),
    };

    const { run, job } = await createEvaluationRunAndJob({
      sessionIdOrUuid: sessionId,
      userId: USER_A['x-test-user-id'],
    });
    await processEvaluationJob(job, { llmProvider: fakeEvalLlm });

    const completedRun = await InterviewEvaluationRun.findById(run._id).lean();
    assert.strictEqual(completedRun.status, 'COMPLETED');
    assert.strictEqual(completedRun.evaluationSummary.overallScore, null);
    assert.strictEqual(completedRun.evaluationSummary.overallStatus, 'FOCUSED_PRACTICE_SCOPED');
    assert.strictEqual(completedRun.coverageSummary.assessmentCoverage, 100);

    const compEvals = await CompetencyEvaluation.find({ evaluationRunId: run._id }).lean();
    const nodeComp = compEvals.find((c) => c.competencyId === 'comp_node');
    const dbComp = compEvals.find((c) => c.competencyId === 'comp_db');
    assert.strictEqual(nodeComp.assessmentStatus, 'ASSESSED');
    assert.strictEqual(nodeComp.score, 4);
    assert.strictEqual(dbComp.assessmentStatus, 'NOT_ASSESSED');
    assert.strictEqual(dbComp.score, null);
  });

  it('REALISTIC_MOCK remains intact and unaffected', async () => {
    const { intake } = await seedReadyBlueprint();
    const res = await request(app)
      .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
      .set(USER_A)
      .send({ practiceMode: 'REALISTIC_MOCK' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.practiceMode, 'REALISTIC_MOCK');
  });

  it('Audit: rejects unauthenticated (401), handles audio/PARTIAL STT, enforces retry cap, and preserves concurrency safety', async () => {
    const { intake } = await seedReadyBlueprint();

    // 401 unauthenticated
    const unauthRes = await request(app)
      .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
      .send({ practiceMode: 'GUIDED_PRACTICE' });
    assert.strictEqual(unauthRes.status, 401);

    const createRes = await request(app)
      .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
      .set(USER_A)
      .send({ practiceMode: 'GUIDED_PRACTICE' });
    const sessionId = createRes.body.data.sessionId;

    await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/start`)
      .set(USER_A)
      .send({ consentGranted: true });

    // Partial transcript must NOT create an attempt
    const partialRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/attempts`)
      .set(USER_A)
      .send({
        idempotencyKey: 'partial_1',
        transcriptText: 'Libuv runs...',
        transcriptStatus: 'PARTIAL',
      });
    assert.strictEqual(partialRes.status, 200);
    assert.strictEqual(partialRes.body.data.ignored, true);
    assert.strictEqual(partialRes.body.data.attempt, null);

    // Wrong questionId rejected for hints
    const wrongQHint = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/hint`)
      .set(USER_A)
      .send({ idempotencyKey: 'hint_wrong_q', questionId: 'q_db_1' });
    assert.strictEqual(wrongQHint.status, 409);

    // Audio upload transcribed via sttAdapter -> Attempt 1
    const audioRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/attempts`)
      .set(USER_A)
      .field('idempotencyKey', 'audio_att_1')
      .attach('audio', Buffer.alloc(128, 1), 'answer.webm');
    assert.strictEqual(audioRes.status, 200);
    assert.strictEqual(audioRes.body.data.attempt.attemptNumber, 1);
    assert.ok(audioRes.body.data.attempt.answerText.includes('Spoken answer'));

    // Concurrent attempt submissions -> at most one gets attemptNumber 2
    const [c1, c2] = await Promise.all([
      request(app)
        .post(`/api/v1/interview-sessions/${sessionId}/attempts`)
        .set(USER_A)
        .send({ idempotencyKey: 'conc_att_a', answerText: 'Concurrent answer A' }),
      request(app)
        .post(`/api/v1/interview-sessions/${sessionId}/attempts`)
        .set(USER_A)
        .send({ idempotencyKey: 'conc_att_b', answerText: 'Concurrent answer B' }),
    ]);
    const statuses = [c1.status, c2.status].sort((a, b) => a - b);
    assert.deepStrictEqual(statuses, [200, 409]);

    // Attempt 3 (max) succeeds, Attempt 4 rejected with 409
    const a3 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/attempts`)
      .set(USER_A)
      .send({ idempotencyKey: 'att_3_final', answerText: 'Third attempt answer' });
    assert.strictEqual(a3.status, 200);
    assert.strictEqual(a3.body.data.attempt.attemptNumber, 3);

    const a4 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/attempts`)
      .set(USER_A)
      .send({ idempotencyKey: 'att_4_over', answerText: 'Fourth attempt should fail' });
    assert.strictEqual(a4.status, 409);

    // Simultaneous continue requests -> exactly one advances, zero duplicate turns
    const [contA, contB] = await Promise.all([
      request(app)
        .post(`/api/v1/interview-sessions/${sessionId}/continue`)
        .set(USER_A)
        .send({ idempotencyKey: 'conc_cont_a' }),
      request(app)
        .post(`/api/v1/interview-sessions/${sessionId}/continue`)
        .set(USER_A)
        .send({ idempotencyKey: 'conc_cont_b' }),
    ]);
    const contStatuses = [contA.status, contB.status].sort((a, b) => a - b);
    assert.deepStrictEqual(contStatuses, [200, 409]);

    const dbSession = await InterviewSession.findOne({ sessionId }).lean();
    assert.strictEqual(dbSession.currentQuestionId, 'q_db_1');
    const q1CandidateTurns = await InterviewTurn.find({
      sessionId: dbSession._id,
      questionId: 'q_node_1',
      speaker: 'CANDIDATE',
    }).lean();
    assert.strictEqual(q1CandidateTurns.length, 1);
  });
});
