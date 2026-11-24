/**
 * End-to-end interview orchestration: Module 5 session lifecycle -> outbox -> Module 6 worker.
 *
 *   create -> start (consent + opening question) -> answer q1 -> q2 -> q3 -> wrap-up
 *   -> INTERVIEW_SESSION_COMPLETED outbox event
 *   -> EvaluationWorker (real poll loop) picks it up WITHOUT a restart or an explicit API call
 *   -> evaluation run + report -> outbox event closed (DISPATCHED)
 *
 * LLM and TTS are stubbed; everything else (state machine, repositories, worker, leases) is real.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

const { InterviewIntake } = require('../modules/intake/interviewIntake.model');
const { InterviewBlueprint } = require('../modules/interview-blueprint/models/interviewBlueprint.model');
const InterviewSession = require('../modules/interview-orchestrator/session/interviewSession.model');
const InterviewEvent = require('../modules/interview-orchestrator/events/interviewEvent.model');
const { createInterviewRuntimeService } = require('../modules/interview-orchestrator/runtime/interview-runtime.service');
const { EvaluationWorker } = require('../modules/interview-evaluation/jobs/evaluation.worker');
const { InterviewEvaluationRun } = require('../modules/interview-evaluation/models/interviewEvaluationRun.model');
const { InterviewEvaluationJob } = require('../modules/interview-evaluation/models/interviewEvaluationJob.model');
const { InterviewReport } = require('../modules/interview-evaluation/models/interviewReport.model');

const USER = 'user_e2e';
let replSet;
let nextDecision = null;

const interviewerLlm = {
  generateStructuredJson: async () => ({ provider: 'fake', model: 'fake', data: nextDecision }),
};
const fakeTts = {
  synthesize: async () => ({ ok: true, buffer: Buffer.alloc(200), mimeType: 'audio/mpeg' }),
};
const svc = createInterviewRuntimeService({ llmProvider: interviewerLlm, ttsProvider: fakeTts });

/** Evaluator stub: quotes the candidate's actual transcript back as evidence (as a real model would). */
let evaluatorCalls = 0;
const evaluatorLlm = {
  generateStructuredJson: async ({ userPrompt }) => {
    evaluatorCalls += 1;
    const open = '<UNTRUSTED_CANDIDATE_TRANSCRIPT>';
    const close = '</UNTRUSTED_CANDIDATE_TRANSCRIPT>';
    let turns = [];
    try {
      turns = JSON.parse(userPrompt.slice(userPrompt.indexOf(open) + open.length, userPrompt.indexOf(close)).trim());
    } catch (_) {
      turns = [];
    }
    const t = turns[0] || {};
    const text = String(t.spokenText || '');
    return {
      provider: 'fake',
      model: 'fake-eval',
      data: {
        rating: 4,
        criterionEvaluations: [],
        evidenceReferences: text ? [{ turnId: String(t.turnId), quote: text.slice(0, 40) }] : [],
        strengths: ['Structured answer'],
        developmentAreas: ['Add measurable trade-offs'],
        missingEvidence: [],
        explanation: 'Stub evaluation for the end-to-end orchestration test.',
      },
    };
  },
};

const oid = () => new mongoose.Types.ObjectId();

/** A complete Module 4 rubric (all five rating descriptors), as the blueprint generator produces. */
const rubricFor = (questionId) => ({
  rubricId: `rub_${questionId}`,
  questionId,
  ratingDescriptors: [1, 2, 3, 4, 5].map((rating) => ({ rating, descriptor: `Level ${rating} answer for ${questionId}` })),
  expectedEvidence: ['Concrete, technically correct explanation'],
  criticalMisconceptions: [],
  partialCreditGuidance: 'Credit partially correct reasoning.',
});

const seedSession = async () => {
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
      { questionId: 'q1', evaluationRubricId: 'rub_q1', stageId: 's1', competencyId: 'C_COMM', consistencyClass: 'CORE_ASSESSMENT', questionText: 'Tell me about a project.' },
      { questionId: 'q2', evaluationRubricId: 'rub_q2', stageId: 's2', competencyId: 'C_API', consistencyClass: 'CORE_ASSESSMENT', questionText: 'How do you design a REST API?' },
      { questionId: 'q3', evaluationRubricId: 'rub_q3', stageId: 's3', competencyId: 'C_DB', consistencyClass: 'CORE_ASSESSMENT', questionText: 'How do indexes work?' },
    ],
    evaluationRubrics: ['q1', 'q2', 'q3'].map(rubricFor),
  });
  return svc.createSession({ intakeId: String(intake.insertedId), userId: USER, practiceMode: 'REALISTIC_MOCK' });
};

const waitFor = async (predicate, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};

describe('Interview orchestration end-to-end (Module 5 -> outbox -> Module 6)', () => {
  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('a completed interview is evaluated automatically by the running worker', async () => {
    // The server (and its evaluation worker) is already running when the interview happens.
    // Previously the outbox was only swept at worker startup, so this case was never evaluated.
    const worker = new EvaluationWorker({ llmProvider: evaluatorLlm, pollIntervalMs: 100, workerId: 'e2e-worker' });
    await worker.start();
    try {
    // ── Module 5: run the interview ──────────────────────────────────────────
    const created = await seedSession();
    await svc.startSession({ sessionId: created.sessionId, userId: USER, consentGranted: true });

    const answers = [
      ['k1', 'In my last project I built an order service and split it into three bounded contexts', { action: 'ADVANCE_STAGE', spokenResponse: 'Thanks. Next stage.' }],
      ['k2', 'I design REST APIs around resources with versioned URLs and idempotent PUT semantics', { action: 'ADVANCE_STAGE', spokenResponse: 'Good. Last stage.' }],
      ['k3', 'A B-tree index keeps keys sorted so range queries avoid full collection scans', { action: 'WRAP_UP_INTERVIEW', spokenResponse: 'Thank you, that is all.' }],
    ];
    let last;
    for (const [key, text, decision] of answers) {
      nextDecision = decision;
      last = await svc.processTurn({ sessionId: created.sessionId, userId: USER, idempotencyKey: key, transcriptText: text });
    }

    const session = await InterviewSession.findOne({ sessionId: created.sessionId }).lean();
    assert.strictEqual(session.status, 'COMPLETED', `session should be COMPLETED, got ${session.status}`);
    assert.ok(last, 'final turn returned');

    const pending = await InterviewEvent.findOne({ sessionId: session._id, eventType: 'INTERVIEW_SESSION_COMPLETED' }).lean();
    assert.ok(pending, 'completion outbox event written');
    assert.strictEqual(pending.outboxStatus, 'PENDING_DISPATCH');

    // ── Module 6: the already-running worker picks it up on its own ──────────
    {
      // The worker closes the outbox entry, then marks its job COMPLETED: wait for both.
      const closed = await waitFor(async () => {
        const e = await InterviewEvent.findById(pending._id).lean();
        const j = await InterviewEvaluationJob.findOne({ sessionId: session._id }).lean();
        return e.outboxStatus !== 'PENDING_DISPATCH' && j && !['QUEUED', 'PROCESSING'].includes(j.status);
      }, 30000);

      const run = await InterviewEvaluationRun.findOne({ sessionId: session._id }).lean();
      const job = run ? await InterviewEvaluationJob.findOne({ evaluationRunId: run._id }).lean() : null;
      const diag = JSON.stringify({ runStatus: run?.status, failure: run?.failureMessage, job: job && { status: job.status, err: job.lastErrorMessage, stage: job.failureStage } });

      assert.ok(closed, `outbox event was never closed by the worker: ${diag}`);
      assert.ok(run, 'evaluation run created from the outbox event');
      assert.ok(
        ['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'NEEDS_REVIEW', 'INSUFFICIENT_COVERAGE'].includes(run.status),
        `evaluation run should finish, got ${diag}`
      );
      assert.strictEqual(job.status, 'COMPLETED', diag);
      assert.strictEqual(evaluatorCalls, 3, 'each of the three answers was sent to the evaluator');
      const { QuestionEvaluation } = require('../modules/interview-evaluation/models/questionEvaluation.model');
      const scored = await QuestionEvaluation.find({ evaluationRunId: run._id, rating: { $ne: null } }).lean();
      assert.strictEqual(scored.length, 3, 'all three answers received a rubric score');
      assert.ok(await InterviewReport.findOne({ evaluationRunId: run._id }).lean(), 'report generated');

      const evt = await InterviewEvent.findById(pending._id).lean();
      assert.strictEqual(evt.outboxStatus, 'DISPATCHED');
    }
    } finally {
      await worker.stop();
    }
  });
});
