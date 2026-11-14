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
const SessionMemory = require('../modules/interview-orchestrator/memory/sessionMemory.model');
const controller = require('../modules/interview-orchestrator/interview-orchestrator.controller');
const {
  createInterviewRuntimeService,
} = require('../modules/interview-orchestrator/runtime/interview-runtime.service');

const USER_A = { 'x-test-user-id': 'user_m5_a', 'x-test-email': 'a5@evalix.dev' };
const USER_B = { 'x-test-user-id': 'user_m5_b', 'x-test-email': 'b5@evalix.dev' };
const INTERNAL_HEADERS = {
  'x-internal-orchestrator-token': env.INTERNAL_ORCHESTRATOR_SECRET,
};

let replSet;

const seedReadyBlueprint = async ({ userId = 'user_m5_a', status = 'READY' } = {}) => {
  let candidate = await CandidateProfile.findOne({ userId });
  if (!candidate) {
    candidate = await CandidateProfile.create({
      userId,
      fullName: 'Shubham Maurya',
      email: 'shubham@evalix.dev',
      phone: '+91-9999900000',
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
  const resumeDocId = new mongoose.Types.ObjectId();
  const intake = await InterviewIntake.create({
    userId,
    candidateProfileId: candidate._id,
    targetJobProfileId: jobProfile._id,
    resumeDocumentId: resumeDocId,
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
    userId,
    targetJobProfileId: jobProfile._id,
    resumeExtractionId: new mongoose.Types.ObjectId(),
    jobDescriptionExtractionId: new mongoose.Types.ObjectId(),
    analysisVersion: 1,
    analysisStatus: 'READY_FOR_INTERVIEW_PLANNING',
  });
  const blueprint = await InterviewBlueprint.create({
    intakeId: intake._id,
    candidateProfileId: candidate._id,
    candidateAnalysisId: analysis._id,
    userId,
    blueprintVersion: 1,
    status,
    isLockedForSession: false,
    interviewType: 'TECHNICAL',
    targetRole: 'Backend Node.js Engineer',
    seniorityLevel: 'MID',
    totalDurationSeconds: 1800,
    competencyPlan: [
      { competencyId: 'comp_node', name: 'Node.js & Async Architecture', weight: 0.6 },
      { competencyId: 'comp_db', name: 'MongoDB & Indexing', weight: 0.4 },
    ],
    excludedRequirements: ['Kubernetes Operator internals'],
    stages: [
      {
        stageId: 'stg_tech_1',
        stageType: 'CORE_TECHNICAL',
        stageName: 'Core Node.js',
        durationSeconds: 900,
        order: 1,
      },
      {
        stageId: 'stg_tech_2',
        stageType: 'SYSTEM_DESIGN',
        stageName: 'Database Design',
        durationSeconds: 900,
        order: 2,
      },
    ],
    questionPlan: [
      {
        questionId: 'q_node_1',
        stageId: 'stg_tech_1',
        consistencyClass: 'CORE_ASSESSMENT',
        competencyId: 'comp_node',
        questionText: 'How does the Node.js event loop handle microtasks vs macrotasks?',
        followUpPolicy: { maxFollowUps: 1, allowedProbeTypes: ['DEPTH_PROBE', 'CLARIFICATION'] },
        order: 1,
      },
      {
        questionId: 'q_node_2',
        stageId: 'stg_tech_1',
        consistencyClass: 'CORE_ASSESSMENT',
        competencyId: 'comp_node',
        questionText: 'How do you prevent event-loop blocking in CPU-intensive endpoints?',
        followUpPolicy: { maxFollowUps: 1, allowedProbeTypes: ['DEPTH_PROBE'] },
        order: 2,
      },
      {
        questionId: 'q_db_1',
        stageId: 'stg_tech_2',
        consistencyClass: 'CORE_ASSESSMENT',
        competencyId: 'comp_db',
        questionText: 'How do compound indexes improve MongoDB query performance?',
        followUpPolicy: { maxFollowUps: 1, allowedProbeTypes: ['DEPTH_PROBE'] },
        order: 3,
      },
    ],
    evaluationRubrics: [{ competencyId: 'comp_node', privateAnchor: 'SECRET_RUBRIC_ANCHOR_DO_NOT_LEAK' }],
  });

  return { intake, blueprint };
};

describe('Module 5 Integration Tests — Live AI Interview Orchestration Engine', () => {
  let llmCallCount = 0;
  let ttsShouldFail = false;

  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  });

  after(async () => {
    controller.setRuntimeService(null);
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    llmCallCount = 0;
    ttsShouldFail = false;
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
    ]);

    const fakeLlm = {
      generateStructuredJson: async ({ userPrompt }) => {
        llmCallCount += 1;
        const currentQ = userPrompt.match(/"questionId":\s*"([^"]+)"/)?.[1] || '';
        const followUpCount = Number(
          userPrompt.match(/"currentFollowUpCount":\s*(\d+)/)?.[1] || 0
        );
        // Deterministic sequence based on current state in prompt
        if (currentQ === 'q_node_1' && followUpCount === 0) {
          return {
            provider: 'fake-gemini',
            model: 'fake-model',
            usage: { totalTokens: 50 },
            data: {
              action: 'ASK_FOLLOW_UP',
              followUpType: 'DEPTH_PROBE',
              spokenResponse: 'Good explanation! Specifically, how does process.nextTick differ from Promise.then?',
              reasoning: 'Probe microtask priority',
              candidateClaims: [{ summary: 'Mentioned libuv phases and Promise queue', technologies: ['Node.js', 'libuv'] }],
              topicsMentioned: ['event loop', 'microtasks'],
              observedSignals: ['understands async queues'],
            },
          };
        }
        if (currentQ === 'q_node_1' && followUpCount === 1) {
          return {
            provider: 'fake-gemini',
            model: 'fake-model',
            usage: { totalTokens: 50 },
            data: {
              action: 'MOVE_NEXT_QUESTION',
              followUpType: 'NONE',
              spokenResponse: 'Thank you. Next question: How do you prevent event-loop blocking in CPU-intensive endpoints?',
              reasoning: 'Move to q_node_2',
              candidateClaims: [{ summary: 'Explained nextTick runs before Promise microtasks', technologies: ['Node.js'] }],
              topicsMentioned: ['process.nextTick'],
              observedSignals: ['accurate microtask ordering'],
            },
          };
        }
        if (currentQ === 'q_node_2') {
          return {
            provider: 'fake-gemini',
            model: 'fake-model',
            usage: { totalTokens: 50 },
            data: {
              action: 'ADVANCE_STAGE',
              followUpType: 'NONE',
              spokenResponse: 'Great! Moving to Database Design: How do compound indexes improve MongoDB query performance?',
              reasoning: 'Advance to stg_tech_2',
              candidateClaims: [{ summary: 'Uses worker_threads for CPU bound tasks', technologies: ['worker_threads'] }],
              topicsMentioned: ['worker threads'],
              observedSignals: ['knows worker_threads'],
            },
          };
        }
        return {
          provider: 'fake-gemini',
          model: 'fake-model',
          usage: { totalTokens: 50 },
          data: {
            action: 'WRAP_UP_INTERVIEW',
            followUpType: 'NONE',
            spokenResponse: 'Thank you very much for your answers today! That wraps up our interview.',
            reasoning: 'All stages covered',
            candidateClaims: [{ summary: 'Explained ESR rule for compound indexes', technologies: ['MongoDB'] }],
            topicsMentioned: ['compound indexes'],
            observedSignals: ['knows ESR rule'],
          },
        };
      },
    };

    const fakeTts = {
      synthesize: async ({ text }) => {
        if (ttsShouldFail) {
          throw new Error('Simulated TTS outage');
        }
        return {
          buffer: Buffer.from(`AUDIO:${text}`),
          mimeType: 'audio/mpeg',
          provider: 'fake-elevenlabs',
          model: 'eleven_flash_v2_5',
        };
      },
    };

    controller.setRuntimeService(
      createInterviewRuntimeService({
        llmProvider: fakeLlm,
        ttsProvider: fakeTts,
      })
    );
  });

  it('rejects session creation if blueprint is not READY and locks blueprint once created', async () => {
    const { intake: badIntake } = await seedReadyBlueprint({ status: 'GENERATING' });
    const failRes = await request(app)
      .post(`/api/v1/interview-intakes/${badIntake._id}/interview-sessions`)
      .set(USER_A)
      .send({});
    assert.strictEqual(failRes.status, 409);

    const { intake, blueprint } = await seedReadyBlueprint({ status: 'READY' });
    const createRes = await request(app)
      .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
      .set(USER_A)
      .send({});
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.data.status, 'READY');
    assert.strictEqual(createRes.body.data.blueprintChecksum, undefined);

    const lockedBp = await InterviewBlueprint.findById(blueprint._id);
    assert.strictEqual(lockedBp.isLockedForSession, true);
  });

  it('requires consent to start, conducts full adaptive interview, emits outbox event, and enforces idempotency', async () => {
    const { intake } = await seedReadyBlueprint();
    const createRes = await request(app)
      .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
      .set(USER_A)
      .send({});
    const sessionId = createRes.body.data.sessionId;

    // Consent required
    const noConsentRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/start`)
      .set(USER_A)
      .send({ consentGranted: false });
    assert.strictEqual(noConsentRes.status, 400);

    // Start with consent
    const startRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/start`)
      .set(USER_A)
      .send({ consentGranted: true });
    assert.strictEqual(startRes.status, 200);
    assert.strictEqual(startRes.body.data.session.status, 'IN_PROGRESS');
    assert.strictEqual(startRes.body.data.session.currentQuestionId, 'q_node_1');

    // Partial transcript must be ignored and NOT call LLM
    const partialRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/turns`)
      .set(USER_A)
      .send({
        idempotencyKey: 'turn-partial-1',
        transcriptText: 'um...',
        transcriptStatus: 'PARTIAL',
      });
    assert.strictEqual(partialRes.status, 200);
    assert.strictEqual(partialRes.body.data.ignored, true);
    assert.strictEqual(llmCallCount, 0);

    // Turn 1 -> ASK_FOLLOW_UP
    const t1 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/turns`)
      .set(USER_A)
      .send({
        idempotencyKey: 'turn-1',
        transcriptText: 'Node.js uses libuv and runs Promise microtasks after each phase.',
        transcriptStatus: 'FINAL',
      });
    assert.strictEqual(t1.status, 200);
    assert.strictEqual(t1.body.data.aiTurn.turnType, 'FOLLOW_UP');
    assert.strictEqual(llmCallCount, 1);

    // Idempotent replay -> no extra LLM call
    const t1Replay = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/turns`)
      .set(USER_A)
      .send({
        idempotencyKey: 'turn-1',
        transcriptText: 'Node.js uses libuv...',
        transcriptStatus: 'FINAL',
      });
    assert.strictEqual(t1Replay.status, 200);
    assert.strictEqual(t1Replay.body.data.idempotentReplay, true);
    assert.strictEqual(llmCallCount, 1);

    // Turn 2 -> MOVE_NEXT_QUESTION (q_node_2)
    const t2 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/turns`)
      .set(USER_A)
      .send({
        idempotencyKey: 'turn-2',
        transcriptText: 'process.nextTick runs before Promise.then in the microtask queue.',
      });
    assert.strictEqual(t2.status, 200);
    assert.strictEqual(t2.body.data.session.currentQuestionId, 'q_node_2');

    // Turn 3 -> ADVANCE_STAGE (stg_tech_2, q_db_1)
    const t3 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/turns`)
      .set(USER_A)
      .send({
        idempotencyKey: 'turn-3',
        transcriptText: 'We offload CPU work to worker_threads or background queues.',
      });
    assert.strictEqual(t3.status, 200);
    assert.strictEqual(t3.body.data.session.currentStageId, 'stg_tech_2');
    assert.strictEqual(t3.body.data.session.currentQuestionId, 'q_db_1');

    // Turn 4 -> WRAP_UP_INTERVIEW -> COMPLETED + Outbox Event
    const t4 = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/turns`)
      .set(USER_A)
      .send({
        idempotencyKey: 'turn-4',
        transcriptText: 'We follow the Equality, Sort, Range rule for compound indexes.',
      });
    assert.strictEqual(t4.status, 200);
    assert.strictEqual(t4.body.data.session.status, 'COMPLETED');

    const completedEvt = await InterviewEvent.findOne({ eventType: 'INTERVIEW_SESSION_COMPLETED' });
    assert.ok(completedEvt);
    assert.strictEqual(completedEvt.outboxStatus, 'PENDING_DISPATCH');
    assert.ok(completedEvt.payload.coveredCompetencyIds.includes('comp_db'));

    // Transcript endpoint never leaks internal adaptiveDecision or llmMetadata
    const transcriptRes = await request(app)
      .get(`/api/v1/interview-sessions/${sessionId}/transcript`)
      .set(USER_A);
    assert.strictEqual(transcriptRes.status, 200);
    for (const turn of transcriptRes.body.data.turns) {
      assert.strictEqual(turn.adaptiveDecision, undefined);
      assert.strictEqual(turn.llmMetadata, undefined);
    }
  });

  it('handles pause/resume, barge-in interruption, TTS outage + retry without re-calling LLM, and security/IDOR', async () => {
    const { intake } = await seedReadyBlueprint();
    const createRes = await request(app)
      .post(`/api/v1/interview-intakes/${intake._id}/interview-sessions`)
      .set(USER_A)
      .send({});
    const sessionId = createRes.body.data.sessionId;

    await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/start`)
      .set(USER_A)
      .send({ consentGranted: true });

    // IDOR check: USER_B cannot access or submit turn
    const idorGet = await request(app)
      .get(`/api/v1/interview-sessions/${sessionId}`)
      .set(USER_B);
    assert.strictEqual(idorGet.status, 403);

    // Internal route auth check
    const noInternalAuth = await request(app)
      .get(`/api/v1/internal/interview-sessions/${sessionId}/context`);
    assert.strictEqual(noInternalAuth.status, 403);

    // Barge-in interruption keeps q_node_1 active
    const interruptRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/interrupt`)
      .set(USER_A)
      .send({ interruptedAtMs: 1200 });
    assert.strictEqual(interruptRes.status, 200);
    assert.strictEqual(interruptRes.body.data.interrupted, true);

    // Pause & Resume
    const pauseRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/pause`)
      .set(USER_A)
      .send({ reason: 'Network reconnect' });
    assert.strictEqual(pauseRes.status, 200);
    assert.strictEqual(pauseRes.body.data.status, 'PAUSED');

    const blockedTurn = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/turns`)
      .set(USER_A)
      .send({ idempotencyKey: 'while-paused', transcriptText: 'Hello' });
    assert.strictEqual(blockedTurn.status, 409);

    const resumeRes = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/resume`)
      .set(USER_A);
    assert.strictEqual(resumeRes.status, 200);
    assert.strictEqual(resumeRes.body.data.status, 'IN_PROGRESS');

    // Simulate TTS failure on turn, verify spokenText preserved and retry works without LLM call
    ttsShouldFail = true;
    const tFailTts = await request(app)
      .post(`/api/v1/interview-sessions/${sessionId}/turns`)
      .set(USER_A)
      .send({
        idempotencyKey: 'turn-tts-fail',
        transcriptText: 'Event loop runs microtasks after timers.',
      });
    assert.strictEqual(tFailTts.status, 200);
    assert.strictEqual(tFailTts.body.data.aiTurn.processingStatus, 'TTS_FAILED');
    assert.strictEqual(tFailTts.body.data.tts.fallbackToBrowser, true);
    assert.ok(tFailTts.body.data.aiTurn.spokenText.length > 10);

    const callsBeforeRetry = llmCallCount;
    ttsShouldFail = false;
    const retryRes = await request(app)
      .post(
        `/api/v1/internal/interview-sessions/${sessionId}/turns/${tFailTts.body.data.aiTurn.id}/retry-tts`
      )
      .set(INTERNAL_HEADERS);
    assert.strictEqual(retryRes.status, 200);
    assert.strictEqual(retryRes.body.data.turn.processingStatus, 'COMPLETED');
    assert.strictEqual(retryRes.body.data.tts.ok, true);
    assert.strictEqual(llmCallCount, callsBeforeRetry);
  });
});
