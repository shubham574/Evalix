const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

const app = require('../app');
const env = require('../config/env');
const { InterviewIntake } = require('../modules/intake/interviewIntake.model');
const { InterviewBlueprint } = require('../modules/interview-blueprint/models/interviewBlueprint.model');
const InterviewSession = require('../modules/interview-orchestrator/session/interviewSession.model');
const InterviewTurn = require('../modules/interview-orchestrator/turns/interviewTurn.model');
const InterviewEvent = require('../modules/interview-orchestrator/events/interviewEvent.model');
const SessionMemory = require('../modules/interview-orchestrator/memory/sessionMemory.model');
const controller = require('../modules/interview-orchestrator/interview-orchestrator.controller');
const {
  createInterviewRuntimeService,
} = require('../modules/interview-orchestrator/runtime/interview-runtime.service');
const { fastPathClassify } = require('../modules/interview-orchestrator/conversation/answer-classifier');
const { InactivitySweeper } = require('../modules/interview-orchestrator/runtime/inactivity-sweeper');

const USER = 'user_m5_fixes';
const USER_HEADERS = { 'x-test-user-id': USER, 'x-test-email': 'fixes5@evalix.dev' };
const ANSWER = 'I would use an async queue with backpressure and bounded workers for this';

let replSet;
let nextDecision = null;
let llmCalls = 0;

const fakeLlm = {
  generateStructuredJson: async () => {
    llmCalls += 1;
    return { provider: 'fake', model: 'fake', data: nextDecision };
  },
};
const fakeTts = {
  synthesize: async () => ({ ok: true, buffer: Buffer.alloc(200), mimeType: 'audio/mpeg' }),
};
const svc = createInterviewRuntimeService({ llmProvider: fakeLlm, ttsProvider: fakeTts });

const oid = () => new mongoose.Types.ObjectId();

/** 3 stages, 3 questions; q2 is the only C_API question (used by the focused-practice test). */
const seedSession = async ({ practiceMode = 'REALISTIC_MOCK', competencyId = null } = {}) => {
  const intake = await InterviewIntake.collection.insertOne({
    userId: USER,
    status: 'READY_FOR_ANALYSIS',
    interviewType: 'TECHNICAL',
  });
  await InterviewBlueprint.collection.insertOne({
    intakeId: intake.insertedId,
    candidateProfileId: oid(),
    candidateAnalysisId: oid(),
    userId: USER,
    blueprintVersion: 1,
    status: 'READY',
    interviewType: 'TECHNICAL',
    targetRole: 'Backend Engineer',
    seniorityLevel: 'MID',
    totalDurationSeconds: 1800,
    competencyPlan: [
      { competencyId: 'C_COMM', name: 'Communication' },
      { competencyId: 'C_API', name: 'API Design' },
      { competencyId: 'C_DB', name: 'Databases' },
    ],
    stages: [
      { stageId: 's1', stageType: 'CORE_TECHNICAL', stageName: 'One', durationSeconds: 600 },
      { stageId: 's2', stageType: 'CORE_TECHNICAL', stageName: 'Two', durationSeconds: 600 },
      { stageId: 's3', stageType: 'CORE_TECHNICAL', stageName: 'Three', durationSeconds: 600 },
    ],
    questionPlan: [
      { questionId: 'q1', stageId: 's1', competencyId: 'C_COMM', consistencyClass: 'CORE_ASSESSMENT', questionText: 'Tell me about a project.' },
      { questionId: 'q2', stageId: 's2', competencyId: 'C_API', consistencyClass: 'CORE_ASSESSMENT', questionText: 'How do you design a REST API?' },
      { questionId: 'q3', stageId: 's3', competencyId: 'C_DB', consistencyClass: 'CORE_ASSESSMENT', questionText: 'How do indexes work?' },
    ],
  });
  return svc.createSession({
    intakeId: String(intake.insertedId),
    userId: USER,
    practiceMode,
    competencyId,
  });
};

const startSession = (s) => svc.startSession({ sessionId: s.sessionId, userId: USER, consentGranted: true });

/** Makes the NEXT session lookup return `staleDoc`, simulating a request that loaded the
 * session before a concurrent write landed (deterministic interleaving). */
const serveStaleSessionOnce = (staleDoc) => {
  const original = InterviewSession.findOne;
  InterviewSession.findOne = function patchedFindOne() {
    InterviewSession.findOne = original;
    return Promise.resolve(staleDoc);
  };
  return () => {
    InterviewSession.findOne = original;
  };
};

const assertConflict = async (promise) => {
  await assert.rejects(promise, (err) => {
    assert.strictEqual(err.statusCode, 409, `expected 409, got ${err.statusCode}: ${err.message}`);
    return true;
  });
};

describe('Module 5 — orchestration audit fixes (regression)', () => {
  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([InterviewSession.init(), InterviewTurn.init(), InterviewEvent.init()]);
    controller.setRuntimeService(svc);
  });

  after(async () => {
    controller.setRuntimeService(null);
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    nextDecision = null;
    llmCalls = 0;
    await Promise.all([
      InterviewIntake.deleteMany({}),
      InterviewBlueprint.deleteMany({}),
      InterviewSession.deleteMany({}),
      InterviewTurn.deleteMany({}),
      InterviewEvent.deleteMany({}),
      SessionMemory.deleteMany({}),
    ]);
  });

  it('[1] internal routes return 503 when INTERNAL_ORCHESTRATOR_SECRET is not configured', async () => {
    const saved = env.INTERNAL_ORCHESTRATOR_SECRET;
    try {
      env.INTERNAL_ORCHESTRATOR_SECRET = '';
      const res = await request(app)
        .get('/api/v1/internal/interview-sessions/sess_x/context')
        .set('x-internal-orchestrator-token', '');
      assert.strictEqual(res.status, 503);
      assert.strictEqual(res.body.code, 'INTERNAL_ORCHESTRATOR_DISABLED');
    } finally {
      env.INTERNAL_ORCHESTRATOR_SECRET = saved;
    }
    const wrong = await request(app)
      .get('/api/v1/internal/interview-sessions/sess_x/context')
      .set('x-internal-orchestrator-token', 'evalix-internal-orchestrator-dev-secret');
    assert.strictEqual(wrong.status, 403);
  });

  it('[2] fast-path control/off-topic intents do not fire on substantive technical answers', () => {
    const substantive = [
      'I would pass the JWT in the Authorization header and validate it in middleware',
      'We used a wait-free queue so producers never block on consumers',
      'I added retry logic that would repeat the failed request with exponential backoff',
      'I used the useEffect hook and had to hold on to a ref between renders',
      'I built a movie recommendation engine using collaborative filtering in Python',
      'We integrated a third-party payment gateway using webhooks and idempotency keys',
    ];
    for (const text of substantive) {
      const result = fastPathClassify(text);
      assert.ok(
        !result || result.intent === 'SUBSTANTIVE_ANSWER',
        `"${text}" misclassified as ${result?.intent}`
      );
    }
    assert.strictEqual(fastPathClassify('Could you please repeat the question?').intent, 'REQUEST_REPEAT');
    assert.strictEqual(fastPathClassify('Can we please skip this question?').intent, 'REQUEST_SKIP');
    assert.strictEqual(fastPathClassify('wait').intent, 'REQUEST_PAUSE');
    assert.strictEqual(
      fastPathClassify('aaj mausam bahut accha hai aur main cricket khelne ja raha hoon').intent,
      'OFF_TOPIC'
    );
  });

  it('[2] a long answer containing "pass" is not recorded as a skip', async () => {
    const s = await seedSession();
    await startSession(s);
    nextDecision = { action: 'ASK_FOLLOW_UP', followUpType: 'DEPTH_PROBE', spokenResponse: 'Why a header?' };
    const t = await svc.processTurn({
      sessionId: s.sessionId,
      userId: USER,
      idempotencyKey: 'pass-1',
      transcriptText: 'I would pass the JWT in the Authorization header and validate it in middleware',
    });
    assert.deepStrictEqual(t.session.skippedQuestionIds, []);
    assert.strictEqual(t.aiTurn.turnType, 'FOLLOW_UP');
  });

  it('[3] FOCUSED_SKILL_PRACTICE only builds stages and asks questions from the focused snapshot', async () => {
    const s = await seedSession({ practiceMode: 'FOCUSED_SKILL_PRACTICE', competencyId: 'C_API' });
    assert.deepStrictEqual(
      s.stageProgress.map((st) => st.stageId),
      ['s2']
    );
    const started = await startSession(s);
    assert.strictEqual(started.session.currentQuestionId, 'q2');

    nextDecision = { action: 'ADVANCE_STAGE', spokenResponse: 'Moving on.' };
    const t = await svc.processTurn({
      sessionId: s.sessionId,
      userId: USER,
      idempotencyKey: 'focused-1',
      transcriptText: ANSWER,
    });
    assert.strictEqual(t.session.status, 'COMPLETED');
    assert.deepStrictEqual(t.session.askedQuestionIds, ['q2']);
  });

  it('[4] consent gate cannot be bypassed via /resume or /pause on a READY session', async () => {
    const s = await seedSession();
    await assertConflict(svc.resumeSession({ sessionId: s.sessionId, userId: USER }));
    await assertConflict(svc.pauseSession({ sessionId: s.sessionId, userId: USER }));
    const after = await InterviewSession.findById(s._id).lean();
    assert.strictEqual(after.status, 'READY');

    // Even if a session is IN_PROGRESS without recorded consent (legacy data), turns are refused.
    await InterviewSession.updateOne({ _id: s._id }, { $set: { status: 'IN_PROGRESS' } });
    await assertConflict(
      svc.processTurn({ sessionId: s.sessionId, userId: USER, idempotencyKey: 'nc-1', transcriptText: ANSWER })
    );
    assert.strictEqual(await InterviewTurn.countDocuments({ sessionId: s._id }), 0);
  });

  it('[5] a stale pause/abandon cannot overwrite a session completed by a concurrent turn', async () => {
    const s = await seedSession();
    await startSession(s);
    const staleForPause = await InterviewSession.findById(s._id);
    const staleForEnd = await InterviewSession.findById(s._id);

    // Exhaust the plan so the final wrap-up is legitimate under the WRAP_UP guard.
    await InterviewSession.updateOne(
      { _id: s._id },
      {
        $set: {
          askedQuestionIds: ['q1', 'q2', 'q3'],
          'stageProgress.1.status': 'COMPLETED',
          'stageProgress.2.status': 'COMPLETED',
        },
      }
    );
    nextDecision = { action: 'WRAP_UP_INTERVIEW', spokenResponse: 'Thanks, that is all.' };
    const done = await svc.processTurn({
      sessionId: s.sessionId,
      userId: USER,
      idempotencyKey: 'final-1',
      transcriptText: ANSWER,
    });
    assert.strictEqual(done.session.status, 'COMPLETED');

    let restore = serveStaleSessionOnce(staleForPause);
    try {
      await assertConflict(svc.pauseSession({ sessionId: s.sessionId, userId: USER }));
    } finally {
      restore();
    }

    restore = serveStaleSessionOnce(staleForEnd);
    let endResult;
    try {
      endResult = await svc.endSession({ sessionId: s.sessionId, userId: USER, abandon: true });
    } finally {
      restore();
    }
    assert.strictEqual(endResult.session.status, 'COMPLETED');

    const after = await InterviewSession.findById(s._id).lean();
    assert.strictEqual(after.status, 'COMPLETED');
    assert.strictEqual(after.abandonedAt, null);
    assert.strictEqual(
      await InterviewEvent.countDocuments({ sessionId: s._id, eventType: 'INTERVIEW_SESSION_COMPLETED' }),
      1
    );
    assert.strictEqual(
      await InterviewEvent.countDocuments({ sessionId: s._id, eventType: 'SESSION_ABANDONED' }),
      0
    );
  });

  it('[5] pause and resume still work and bump stateVersion', async () => {
    const s = await seedSession();
    const started = await startSession(s);
    const paused = await svc.pauseSession({ sessionId: s.sessionId, userId: USER });
    assert.strictEqual(paused.status, 'PAUSED');
    assert.strictEqual(paused.stateVersion, started.session.stateVersion + 1);
    const resumed = await svc.resumeSession({ sessionId: s.sessionId, userId: USER });
    assert.strictEqual(resumed.status, 'IN_PROGRESS');
    assert.strictEqual(resumed.stateVersion, started.session.stateVersion + 2);
    await assertConflict(svc.resumeSession({ sessionId: s.sessionId, userId: USER }));
  });

  it('[6] an LLM WRAP_UP_INTERVIEW is rejected while questions remain', async () => {
    const s = await seedSession();
    await startSession(s);
    nextDecision = { action: 'WRAP_UP_INTERVIEW', spokenResponse: 'Thanks, that is all.' };
    const t = await svc.processTurn({
      sessionId: s.sessionId,
      userId: USER,
      idempotencyKey: 'wrap-early',
      transcriptText: ANSWER,
    });
    assert.strictEqual(t.session.status, 'IN_PROGRESS');
    assert.notStrictEqual(t.aiTurn.turnType, 'CLOSING');
    assert.ok(t.aiTurn.adaptiveDecision.fallbackUsed);
    assert.strictEqual(
      await InterviewEvent.countDocuments({ sessionId: s._id, eventType: 'INTERVIEW_SESSION_COMPLETED' }),
      0
    );
  });

  it('[8] /start on a PAUSED session and a concurrent double /start return 409', async () => {
    const s = await seedSession();
    const staleReady = await InterviewSession.findById(s._id);
    await startSession(s);

    // Second /start that loaded the session while it was still READY (double click).
    const restore = serveStaleSessionOnce(staleReady);
    try {
      await assertConflict(startSession(s));
    } finally {
      restore();
    }
    assert.strictEqual(await InterviewTurn.countDocuments({ sessionId: s._id }), 1);

    await svc.pauseSession({ sessionId: s.sessionId, userId: USER });
    await assert.rejects(startSession(s), (err) => err.statusCode === 409 && /resume/i.test(err.message));
    const after = await InterviewSession.findById(s._id).lean();
    assert.strictEqual(after.status, 'PAUSED');
    assert.strictEqual(after.totalTurnCount, 1);
  });

  it('[9a] GUIDED_PRACTICE sessions can be ended and abandoned', async () => {
    const g1 = await seedSession({ practiceMode: 'GUIDED_PRACTICE' });
    await startSession(g1);
    const ended = await svc.endSession({ sessionId: g1.sessionId, userId: USER });
    assert.strictEqual(ended.session.status, 'COMPLETED');
    assert.ok(ended.completedEvent);

    const g2 = await seedSession({ practiceMode: 'GUIDED_PRACTICE' });
    await startSession(g2);
    const abandoned = await svc.endSession({ sessionId: g2.sessionId, userId: USER, abandon: true });
    assert.strictEqual(abandoned.session.status, 'ABANDONED');
  });

  it('[9b] inactivity sweeper abandons stale IN_PROGRESS/PAUSED sessions only', async () => {
    const stale = await seedSession();
    await startSession(stale);
    const stalePaused = await seedSession();
    await startSession(stalePaused);
    await svc.pauseSession({ sessionId: stalePaused.sessionId, userId: USER });
    const fresh = await seedSession();
    await startSession(fresh);

    const thinking = await seedSession();
    await startSession(thinking);

    // Idle past the abandonment windows (2h in progress, 24h paused)
    await InterviewSession.updateOne(
      { _id: stale._id },
      { $set: { lastActivityAt: new Date(Date.now() - env.INTERVIEW_ORCHESTRATOR_ABANDON_AFTER_MS - 60000) } }
    );
    await InterviewSession.updateOne(
      { _id: stalePaused._id },
      { $set: { lastActivityAt: new Date(Date.now() - env.INTERVIEW_ORCHESTRATOR_PAUSED_ABANDON_AFTER_MS - 60000) } }
    );
    // A candidate thinking for 6 minutes (past the 5-minute inactivity timeout) must NOT be abandoned
    await InterviewSession.updateOne(
      { _id: thinking._id },
      { $set: { lastActivityAt: new Date(Date.now() - 6 * 60 * 1000) } }
    );

    const sweeper = new InactivitySweeper({ logger: { error: () => {} } });
    assert.strictEqual(await sweeper.sweepOnce(), 2);
    const byId = async (s) => (await InterviewSession.findById(s._id).lean()).status;
    assert.strictEqual(await byId(stale), 'ABANDONED');
    assert.strictEqual(await byId(stalePaused), 'ABANDONED');
    assert.strictEqual(await byId(fresh), 'IN_PROGRESS');
    assert.strictEqual(await byId(thinking), 'IN_PROGRESS', 'a 6-minute pause is not abandonment');
    assert.strictEqual(
      (await InterviewSession.findById(stale._id).lean()).terminationReason,
      'INACTIVITY_TIMEOUT'
    );
    assert.strictEqual(await sweeper.sweepOnce(), 0);

    sweeper.start();
    await sweeper.stop();
  });

  it('[10] multipart turn submissions accept numeric expectedStateVersion and confidence', async () => {
    const s = await seedSession();
    const started = await startSession(s);
    nextDecision = { action: 'MOVE_NEXT_QUESTION', spokenResponse: 'Next question.' };
    const res = await request(app)
      .post(`/api/v1/interview-sessions/${s.sessionId}/turns`)
      .set(USER_HEADERS)
      .field('idempotencyKey', 'multipart-1')
      .field('transcriptText', ANSWER)
      .field('expectedStateVersion', String(started.session.stateVersion))
      .field('confidence', '0.9');
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.data.idempotentReplay, false);

    const stale = await request(app)
      .post(`/api/v1/interview-sessions/${s.sessionId}/turns`)
      .set(USER_HEADERS)
      .field('idempotencyKey', 'multipart-2')
      .field('transcriptText', ANSWER)
      .field('expectedStateVersion', String(started.session.stateVersion));
    assert.strictEqual(stale.status, 409);
  });

  it('[11] empty transcript credits active time, updates activePrompt and replays same-key retries', async () => {
    const s = await seedSession();
    await startSession(s);
    await InterviewSession.updateOne(
      { _id: s._id },
      { $set: { lastActivityAt: new Date(Date.now() - 120000) } }
    );
    const t = await svc.processTurn({
      sessionId: s.sessionId,
      userId: USER,
      idempotencyKey: 'empty-1',
      transcriptText: '',
    });
    assert.strictEqual(t.emptyTranscript, true);
    assert.ok(t.session.activeDurationSeconds >= 119, `active=${t.session.activeDurationSeconds}`);
    assert.strictEqual(t.session.activePrompt.turnNumber, t.aiTurn.turnNumber);
    assert.strictEqual(llmCalls, 0);

    const replay = await svc.processTurn({
      sessionId: s.sessionId,
      userId: USER,
      idempotencyKey: 'empty-1',
      transcriptText: '',
    });
    assert.strictEqual(replay.idempotentReplay, true);
    assert.strictEqual(await InterviewTurn.countDocuments({ sessionId: s._id }), 3);
  });
});
