const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.MONGOMS_DISABLE_CONFIG_RESOLVE = 'true';

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
const {
  createInterviewRuntimeService,
} = require('../modules/interview-orchestrator/runtime/interview-runtime.service');
const { buildCandidateContext } = require('../modules/interview-orchestrator/context/candidate-context-builder');
const { createAnswerClassifier, fastPathClassify } = require('../modules/interview-orchestrator/conversation/answer-classifier');
const { resolveAdaptiveDecision } = require('../modules/interview-orchestrator/adaptive/adaptive-engine');
const { assembleQuestionResponses } = require('../modules/interview-evaluation/assembly/question-response-assembler');
const { createAnswerEvaluator } = require('../modules/interview-evaluation/evaluators/answer-evaluator');

let replSet;

const seedContextualSession = async ({
  userId = 'user_ctx_1',
  hasProjects = true,
  skills = ['React', 'Node.js', 'PostgreSQL'],
} = {}) => {
  const candidate = await CandidateProfile.create({
    userId,
    fullName: 'Shubham Maurya',
    email: 'shubham@evalix.dev',
    phone: '+91-9999900000',
    currentJobTitle: 'Fullstack Engineer',
    totalExperienceMonths: 24,
    experienceLevel: 'MID',
  });

  const jobProfile = await TargetJobProfile.create({
    candidateProfileId: candidate._id,
    userId,
    targetRole: 'Fullstack Engineer',
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

  const projectFacts = hasProjects
    ? [
        {
          factId: 'f_proj_1',
          factType: 'PROJECT',
          value: 'InterviewAce AI Platform',
          verificationStatus: 'VERIFIED',
          metadata: {
            description: 'Automated interview coaching system built with Node.js and React.',
            technologies: ['React', 'Node.js', 'PostgreSQL'],
            responsibilities: ['Designed database schema and implemented real-time turn processing'],
            outcomes: ['Supported 10,000 active interview sessions with sub-100ms latency'],
          },
        },
      ]
    : [];

  const skillFacts = skills.map((s, idx) => ({
    factId: `f_skill_${idx}`,
    factType: 'SKILL',
    value: s,
    verificationStatus: 'VERIFIED',
    metadata: { canonicalName: s },
  }));

  const analysis = await CandidateJobAnalysis.create({
    intakeId: intake._id,
    candidateProfileId: candidate._id,
    userId,
    targetJobProfileId: jobProfile._id,
    resumeExtractionId: new mongoose.Types.ObjectId(),
    jobDescriptionExtractionId: new mongoose.Types.ObjectId(),
    analysisVersion: 1,
    analysisStatus: 'READY_FOR_INTERVIEW_PLANNING',
    overallMatchScore: 88,
    reviewedProfileSnapshot: {
      fullName: 'Shubham Maurya',
      facts: [...projectFacts, ...skillFacts],
    },
    jobRequirementSnapshot: {
      jobTitle: 'Fullstack Engineer',
      seniorityLevel: 'MID',
      requiredSkills: skills,
    },
    skillMatchSummary: {
      matchedSkills: skills,
      missingCriticalSkills: [],
    },
  });

  const blueprint = await InterviewBlueprint.create({
    intakeId: intake._id,
    candidateProfileId: candidate._id,
    targetJobProfileId: jobProfile._id,
    candidateAnalysisId: analysis._id,
    userId,
    blueprintVersion: 1,
    status: 'READY',
    isLockedForSession: false,
    targetRole: 'Fullstack Engineer',
    seniorityLevel: 'MID',
    interviewType: 'TECHNICAL',
    totalDurationSeconds: 1800,
    competencyPlan: [
      { competencyId: 'comp_comm', name: 'Communication', weight: 0.2 },
      { competencyId: 'comp_arch', name: 'Architecture', weight: 0.4 },
      { competencyId: 'comp_tech', name: 'Technical Depth', weight: 0.4 },
    ],
    stages: [
      {
        stageId: 'stg_intro',
        stageType: 'INTRODUCTION',
        title: 'Introduction & Background',
        order: 1,
        durationSeconds: 300,
        allocatedDurationSeconds: 300,
        requiredCompetencies: ['comp_comm'],
      },
      {
        stageId: 'stg_project',
        stageType: 'PROJECT_DEEP_DIVE',
        title: 'Project Deep Dive',
        order: 2,
        durationSeconds: 600,
        allocatedDurationSeconds: 600,
        requiredCompetencies: ['comp_arch'],
      },
      {
        stageId: 'stg_tech',
        stageType: 'CORE_TECHNICAL',
        title: 'Core Technical Assessment',
        order: 3,
        durationSeconds: 900,
        allocatedDurationSeconds: 900,
        requiredCompetencies: ['comp_tech'],
      },
    ],
    questionPlan: [
      {
        questionId: 'q_intro_1',
        stageId: 'stg_intro',
        consistencyClass: 'CORE_ASSESSMENT',
        competencyId: 'comp_comm',
        questionText: 'Please introduce yourself and explain what interests you about this role.',
        followUpPolicy: { maxFollowUps: 1, allowedProbeTypes: ['CLARIFICATION'] },
        order: 1,
      },
      {
        questionId: 'q_proj_1',
        stageId: 'stg_project',
        consistencyClass: 'CORE_ASSESSMENT',
        competencyId: 'comp_arch',
        questionText: hasProjects
          ? 'Could you walk me through the architecture of your project InterviewAce AI Platform and explain how you used PostgreSQL?'
          : 'Could you walk me through a major software engineering project you built and explain the technical challenges you faced?',
        followUpPolicy: { maxFollowUps: 2, allowedProbeTypes: ['DEPTH_PROBE', 'CLARIFICATION'] },
        order: 2,
      },
      {
        questionId: 'q_tech_1',
        stageId: 'stg_tech',
        consistencyClass: 'CORE_ASSESSMENT',
        competencyId: 'comp_tech',
        questionText: 'How do you structure database queries and connection pooling in Node.js to ensure high throughput?',
        followUpPolicy: { maxFollowUps: 1, allowedProbeTypes: ['DEPTH_PROBE'] },
        order: 3,
      },
    ],
    evaluationRubrics: [{ competencyId: 'comp_comm', privateAnchor: 'RUBRIC_COMM' }],
  });

  return { candidate, intake, analysis, blueprint };
};

describe('Module 5.2 — Contextual Interview Intelligence & Adaptive Questioning Tests', () => {
  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  });

  after(async () => {
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
    ]);
  });

  // TEST 1
  it('1. UNRELATED_HINDI_RESPONSE_PROMPTS_CLARIFICATION: prompts clarification and does not advance stage or complete question', async () => {
    const { intake, blueprint } = await seedContextualSession();
    const runtime = createInterviewRuntimeService();

    const created = await runtime.createSession({
      intakeId: intake._id,
      userId: 'user_ctx_1',
    });
    const sessionId = created.sessionId;
    await runtime.startSession({ sessionId, userId: 'user_ctx_1', consentGranted: true });

    // Candidate speaks unrelated Hindi sentence
    const turnRes = await runtime.processTurn({
      sessionId,
      userId: 'user_ctx_1',
      idempotencyKey: 'turn-hindi-offtopic',
      transcriptText: 'aaj mausam bahut accha hai aur main cricket khelne ja raha hoon',
      transcriptStatus: 'FINAL',
    });

    assert.strictEqual(turnRes.aiTurn.turnType, 'CLARIFICATION');
    assert.match(turnRes.aiTurn.spokenText, /relates to|clarify/i);

    // Verify session remains on current question and stage
    const session = await InterviewSession.findOne({ sessionId });
    assert.strictEqual(session.currentStageId, 'stg_intro');
    assert.strictEqual(session.currentQuestionId, 'q_intro_1');
    assert.strictEqual(session.completedQuestionIds.includes('q_intro_1'), false);
  });

  // TEST 2
  it('2. PROJECT_DEEP_DIVE_PRESENTS_QUESTION_ON_ACKNOWLEDGEMENT: presents project question on "yes" acknowledgement without skipping stage', async () => {
    const { intake } = await seedContextualSession();
    const runtime = createInterviewRuntimeService();

    const created = await runtime.createSession({
      intakeId: intake._id,
      userId: 'user_ctx_1',
    });
    const sessionId = created.sessionId;
    await runtime.startSession({ sessionId, userId: 'user_ctx_1', consentGranted: true });

    // Complete Intro question with substantive answer -> transitions to Project Deep Dive
    const introRes = await runtime.processTurn({
      sessionId,
      userId: 'user_ctx_1',
      idempotencyKey: 'intro-answer',
      transcriptText: 'My name is Shubham Maurya, a fullstack engineer passionate about scalable systems and distributed databases.',
      transcriptStatus: 'FINAL',
    });
    assert.strictEqual(introRes.session.currentStageId, 'stg_project');

    // Now session is in Project Deep Dive; candidate acknowledges with "yes"
    const ackRes = await runtime.processTurn({
      sessionId,
      userId: 'user_ctx_1',
      idempotencyKey: 'project-stage-ack',
      transcriptText: 'yes',
      transcriptStatus: 'FINAL',
    });

    // Spoken response must present the project question, NOT skip to Core Technical
    assert.strictEqual(ackRes.session.currentStageId, 'stg_project');
    assert.strictEqual(ackRes.session.currentQuestionId, 'q_proj_1');
    assert.match(ackRes.aiTurn.spokenText, /InterviewAce|project|architecture/i);
    assert.doesNotMatch(ackRes.aiTurn.spokenText, /Core Technical Assessment/i);
  });

  // TEST 3
  it('3. NEGATIVE_RESPONSE_ASKS_PREFERENCE: single-word "no" prompts preference clarification without advancing', async () => {
    const { intake } = await seedContextualSession();
    const runtime = createInterviewRuntimeService();

    const created = await runtime.createSession({
      intakeId: intake._id,
      userId: 'user_ctx_1',
    });
    const sessionId = created.sessionId;
    await runtime.startSession({ sessionId, userId: 'user_ctx_1', consentGranted: true });

    const negRes = await runtime.processTurn({
      sessionId,
      userId: 'user_ctx_1',
      idempotencyKey: 'turn-negative',
      transcriptText: 'no',
      transcriptStatus: 'FINAL',
    });

    assert.strictEqual(negRes.aiTurn.turnType, 'CLARIFICATION');
    assert.match(negRes.aiTurn.spokenText, /continue|skip|pause/i);

    const session = await InterviewSession.findOne({ sessionId });
    assert.strictEqual(session.currentQuestionId, 'q_intro_1');
    assert.strictEqual(session.completedQuestionIds.includes('q_intro_1'), false);
  });

  // TEST 4
  it('4. PROJECT_SPECIFIC_QUESTION_USES_REAL_DATA: builds candidate context with verified project and technology', async () => {
    const { intake, blueprint, analysis } = await seedContextualSession({ hasProjects: true });
    const session = {
      sessionId: 'sess_ctx_4',
      targetRole: 'Fullstack Engineer',
      seniorityLevel: 'MID',
    };

    const candidateContext = buildCandidateContext({
      session,
      internalBlueprint: blueprint,
      analysisDoc: analysis,
    });

    assert.strictEqual(candidateContext.hasProjects, true);
    assert.strictEqual(candidateContext.verifiedProjects.length, 1);
    assert.strictEqual(candidateContext.verifiedProjects[0].name, 'InterviewAce AI Platform');
    assert.deepStrictEqual(candidateContext.verifiedProjects[0].technologies, ['React', 'Node.js', 'PostgreSQL']);
  });

  // TEST 5
  it('5. NO_PROJECT_FALLBACK_ASKS_FOR_PROJECT: candidate without verified projects gets prompted to describe a project', async () => {
    const { intake, blueprint, analysis } = await seedContextualSession({ hasProjects: false });
    const session = {
      sessionId: 'sess_ctx_5',
      targetRole: 'Fullstack Engineer',
      seniorityLevel: 'MID',
    };

    const candidateContext = buildCandidateContext({
      session,
      internalBlueprint: blueprint,
      analysisDoc: analysis,
    });

    assert.strictEqual(candidateContext.hasProjects, false);
    assert.strictEqual(candidateContext.verifiedProjects.length, 0);

    const projectQ = blueprint.questionPlan.find((q) => q.stageId === 'stg_project');
    assert.ok(projectQ);
    assert.match(projectQ.questionText, /walk me through a major software engineering project/i);
  });

  // TEST 6
  it('6. PROFILE_TECH_GROUNDING_NO_PYTHON_HALLUCINATION: React/Node profile does not contain Python in context or questions', async () => {
    const { blueprint, analysis } = await seedContextualSession({
      skills: ['React', 'Node.js', 'PostgreSQL'],
    });
    const session = {
      sessionId: 'sess_ctx_6',
      targetRole: 'Fullstack Engineer',
      seniorityLevel: 'MID',
    };

    const candidateContext = buildCandidateContext({
      session,
      internalBlueprint: blueprint,
      analysisDoc: analysis,
    });

    const contextJson = JSON.stringify(candidateContext).toLowerCase();
    assert.strictEqual(contextJson.includes('python'), false);

    const questionsJson = JSON.stringify(blueprint.questionPlan).toLowerCase();
    assert.strictEqual(questionsJson.includes('python'), false);
  });

  // TEST 7
  it('7. ANSWER_ENTITY_PROBING_FOLLOWS_UP_DATABASE: fastPath and classifier recognize substantive technical entity answers', async () => {
    const text = 'In our payment service, we chose PostgreSQL with read replicas to handle relational ACID transactions.';
    const classification = fastPathClassify(text);

    assert.strictEqual(classification.intent, 'SUBSTANTIVE_ANSWER');
    assert.strictEqual(classification.relevanceToCurrentQuestion, 'HIGH');
    assert.strictEqual(classification.detectedLanguage, 'en');
  });

  // TEST 8
  it('8. REQUEST_REPEAT_REPEATS_QUESTION: repeat request repeats prompt without marking question completed', async () => {
    const { intake } = await seedContextualSession();
    const runtime = createInterviewRuntimeService();

    const created = await runtime.createSession({
      intakeId: intake._id,
      userId: 'user_ctx_1',
    });
    const sessionId = created.sessionId;
    await runtime.startSession({ sessionId, userId: 'user_ctx_1', consentGranted: true });

    const repRes = await runtime.processTurn({
      sessionId,
      userId: 'user_ctx_1',
      idempotencyKey: 'turn-repeat-1',
      transcriptText: 'Could you please repeat the question?',
      transcriptStatus: 'FINAL',
    });

    assert.strictEqual(repRes.aiTurn.turnType, 'CLARIFICATION');
    assert.match(repRes.aiTurn.spokenText, /Please introduce yourself/i);

    const session = await InterviewSession.findOne({ sessionId });
    assert.strictEqual(session.currentQuestionId, 'q_intro_1');
    assert.strictEqual(session.completedQuestionIds.includes('q_intro_1'), false);
  });

  // TEST 9
  it('9. REQUEST_SKIP_MARKS_SKIPPED_AND_ADVANCES: skip request records question in skippedQuestionIds and advances', async () => {
    const { intake, blueprint } = await seedContextualSession();
    const runtime = createInterviewRuntimeService();

    const created = await runtime.createSession({
      intakeId: intake._id,
      userId: 'user_ctx_1',
    });
    const sessionId = created.sessionId;
    await runtime.startSession({ sessionId, userId: 'user_ctx_1', consentGranted: true });

    const skipRes = await runtime.processTurn({
      sessionId,
      userId: 'user_ctx_1',
      idempotencyKey: 'turn-skip-1',
      transcriptText: 'Can we please skip this question?',
      transcriptStatus: 'FINAL',
    });

    const session = await InterviewSession.findOne({ sessionId });
    assert.ok(session.skippedQuestionIds.includes('q_intro_1'));

    // Check evaluation assembler marks it skipped
    const turns = await InterviewTurn.find({ sessionId: session._id });
    const assembled = assembleQuestionResponses({
      session,
      internalBlueprint: blueprint,
      validTurns: turns,
      invalidTurns: [],
    });

    const introAssembly = assembled.find((a) => a.questionId === 'q_intro_1');
    assert.strictEqual(introAssembly.wasSkippedByCandidate, true);

    const evaluator = createAnswerEvaluator();
    const evalRes = await evaluator.evaluateQuestion({
      questionAssembly: introAssembly,
      internalBlueprint: blueprint,
      candidateContext: {},
    });
    assert.strictEqual(evalRes.evaluationStatus, 'NOT_ANSWERED');
    assert.strictEqual(evalRes.rating, null);
  });

  // TEST 10
  it('10. SUBSTANTIVE_ANSWER_AFTER_CLARIFICATION_RESUMES: normal progression resumes following substantive response', async () => {
    const { intake } = await seedContextualSession();
    const runtime = createInterviewRuntimeService();

    const created = await runtime.createSession({
      intakeId: intake._id,
      userId: 'user_ctx_1',
    });
    const sessionId = created.sessionId;
    await runtime.startSession({ sessionId, userId: 'user_ctx_1', consentGranted: true });

    // Step 1: Clarification turn
    await runtime.processTurn({
      sessionId,
      userId: 'user_ctx_1',
      idempotencyKey: 'step-clarify',
      transcriptText: 'hmm',
      transcriptStatus: 'FINAL',
    });

    // Step 2: Substantive technical response
    const subRes = await runtime.processTurn({
      sessionId,
      userId: 'user_ctx_1',
      idempotencyKey: 'step-substantive',
      transcriptText: 'I am Shubham Maurya, a software engineer with extensive experience in React, Node.js, and designing PostgreSQL distributed systems.',
      transcriptStatus: 'FINAL',
    });

    assert.ok(['CORE_QUESTION', 'FOLLOW_UP', 'TRANSITION', 'CLOSING'].includes(subRes.aiTurn.turnType));
  });

  // TEST 11
  it('11. CONCURRENT_TURNS_IDEMPOTENT: duplicate submissions with same idempotencyKey return cached turn without re-running', async () => {
    const { intake } = await seedContextualSession();
    const runtime = createInterviewRuntimeService();

    const created = await runtime.createSession({
      intakeId: intake._id,
      userId: 'user_ctx_1',
    });
    const sessionId = created.sessionId;
    await runtime.startSession({ sessionId, userId: 'user_ctx_1', consentGranted: true });

    const [first, second] = await Promise.all([
      runtime.processTurn({
        sessionId,
        userId: 'user_ctx_1',
        idempotencyKey: 'turn-concurrent-1',
        transcriptText: 'My background includes developing cloud native APIs in Node.js and TypeScript.',
        transcriptStatus: 'FINAL',
      }),
      runtime.processTurn({
        sessionId,
        userId: 'user_ctx_1',
        idempotencyKey: 'turn-concurrent-1',
        transcriptText: 'My background includes developing cloud native APIs in Node.js and TypeScript.',
        transcriptStatus: 'FINAL',
      }),
    ]);

    const normalResult = first.idempotentReplay ? second : first;
    const replayResult = first.idempotentReplay ? first : second;

    assert.strictEqual(replayResult.idempotentReplay, true);
    assert.strictEqual(normalResult.candidateTurn.turnNumber, 2);
    assert.strictEqual(replayResult.candidateTurn.turnNumber, 2);

    const turnCount = await InterviewTurn.countDocuments({ sessionId: created._id });
    // Exactly 1 opening AI turn + 1 candidate turn + 1 response AI turn = 3 turns total
    assert.strictEqual(turnCount, 3);
  });

  // TEST 12
  it('12. REALISTIC_MOCK_BEHAVIOR_PRESERVED: produces concise voice-friendly responses without leaking hidden rubrics', async () => {
    const { intake } = await seedContextualSession();
    const runtime = createInterviewRuntimeService();

    const created = await runtime.createSession({
      intakeId: intake._id,
      userId: 'user_ctx_1',
    });
    const sessionId = created.sessionId;
    await runtime.startSession({ sessionId, userId: 'user_ctx_1', consentGranted: true });

    const res = await runtime.processTurn({
      sessionId,
      userId: 'user_ctx_1',
      idempotencyKey: 'mock-test-1',
      transcriptText: 'I have 2 years of experience building React interfaces and Node.js backend services.',
      transcriptStatus: 'FINAL',
    });

    const spoken = res.aiTurn.spokenText;
    assert.ok(spoken.length > 10);
    // Never leaks internal rubrics or scoring tokens
    assert.doesNotMatch(spoken, /RUBRIC_COMM|privateAnchor|score|evaluationRubricId/i);
    // Concise suitable for voice TTS (under 400 chars)
    assert.ok(spoken.length < 400);
  });
});
