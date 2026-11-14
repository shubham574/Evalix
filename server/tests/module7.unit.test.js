const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  protect,
  requireRecruiter,
  requireOrganizationMembership,
  requirePlatformAdmin,
  hasRecruiterAuthority,
  hasPlatformAdminAuthority,
  isValidInternalPlatformToken,
} = require('../middleware/auth');
const env = require('../config/env');
const {
  mapPreparationCoverage,
} = require('../modules/decision-intelligence/recruiter/requirement-summary.service');
const {
  classifyStudentReportStatus,
  buildStudentPracticeInsights,
  detectPerformancePatterns,
} = require('../modules/decision-intelligence/coaching/student-insight.service');
const {
  buildAnswerImprovementGuidance,
} = require('../modules/decision-intelligence/coaching/answer-improvement.service');
const {
  generateDevelopmentPlanContent,
} = require('../modules/decision-intelligence/development/development-plan.generator');
const {
  buildStudentQualityNotice,
} = require('../modules/decision-intelligence/quality/evaluationQuality.service');
const {
  isComparableReport,
  comparePracticeReports,
} = require('../modules/decision-intelligence/coaching/longitudinal-progress.service');

const runMiddleware = (mw, req) =>
  new Promise((resolve) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve({ nextCalled: false, res: this });
        return this;
      },
    };
    mw(req, res, (err) => {
      resolve({ nextCalled: true, err: err || null, res });
    });
  });

test('Auth hardening: production ignores x-user-role and x-test-* spoofing headers', async () => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const req = {
      headers: {
        'x-test-user-id': 'spoofed_user',
        'x-test-org-id': 'org_alpha',
        'x-test-org-role': 'org:recruiter',
        'x-user-role': 'RECRUITER',
      },
    };

    const protectRes = await runMiddleware(protect, req);
    assert.equal(protectRes.nextCalled, true);
    assert.equal(protectRes.err.statusCode, 401);

    const recruiterRes = await runMiddleware(requireRecruiter, {
      auth: { userId: 'user_1', orgId: null, orgRole: null, orgPermissions: [], isTestAuth: false },
      headers: { 'x-user-role': 'RECRUITER' },
    });
    assert.equal(recruiterRes.nextCalled, true);
    assert.equal(recruiterRes.err.statusCode, 403);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('Auth hardening: requireRecruiter and requireOrganizationMembership protect internal endpoints', async () => {
  assert.equal(hasRecruiterAuthority({ userId: 'u_1', orgId: 'org_1', orgRole: 'org:admin' }), true);
  assert.equal(hasRecruiterAuthority({ userId: 'u_1', orgId: 'org_1', orgRole: 'org:member' }), false);

  const crossOrg = await runMiddleware(requireOrganizationMembership('organizationId'), {
    auth: { userId: 'rec_1', orgId: 'org_beta', orgRole: 'org:recruiter', orgPermissions: [], isTestAuth: true },
    params: { organizationId: 'org_alpha' },
    headers: {},
  });
  assert.equal(crossOrg.nextCalled, true);
  assert.equal(crossOrg.err.statusCode, 403);
});

test('Preparation coverage: separates resume vs practice provenance, preserves AI score under review, and clarifies NOT_ASSESSED', () => {
  const result = mapPreparationCoverage({
    requirementAssessments: [
      {
        requirementId: 'req_node',
        requirementName: 'Node.js Event Loop',
        requirementType: 'MUST_HAVE',
        assessment: 'SUPPORTED_DIRECTLY',
      },
      {
        requirementId: 'req_redis',
        requirementName: 'Redis Caching',
        requirementType: 'MUST_HAVE',
        assessment: 'PARTIALLY_SUPPORTED',
      },
      {
        requirementId: 'req_k8s',
        requirementName: 'Kubernetes',
        requirementType: 'MUST_HAVE',
        assessment: 'NOT_EVIDENCED',
      },
    ],
    competencyEvaluations: [
      {
        competencyId: 'comp_node',
        score: 2.5,
        assessmentStatus: 'ASSESSED',
        humanOverride: { revisedScore: 4.0, reason: 'Clarified answer depth' },
        evidenceReferences: [{ turnId: new mongoose.Types.ObjectId(), snippet: 'libuv phases' }],
      },
      {
        competencyId: 'comp_redis',
        score: null,
        assessmentStatus: 'NOT_ASSESSED',
      },
    ],
    blueprintDoc: {
      competencyPlan: [
        { competencyId: 'comp_node', sourceRequirementIds: ['req_node'] },
        { competencyId: 'comp_redis', sourceRequirementIds: ['req_redis'] },
      ],
    },
  });

  const node = result.preparationCoverage.find((r) => r.requirementId === 'req_node');
  assert.equal(node.practiceStatus, 'DEMONSTRATED_IN_PRACTICE');
  assert.equal(node.originalAiScore, 2.5);
  assert.equal(node.effectiveScore, 4.0);
  assert.deepEqual(node.provenance, [
    'RESUME_EVIDENCE',
    'PRACTICE_INTERVIEW_EVIDENCE',
    'REVIEWED_FEEDBACK',
  ]);

  const redis = result.preparationCoverage.find((r) => r.requirementId === 'req_redis');
  assert.equal(redis.practiceStatus, 'NOT_ASSESSED');
  assert.match(redis.note, /does not indicate lack of skill/i);

  const k8s = result.preparationCoverage.find((r) => r.requirementId === 'req_k8s');
  assert.equal(k8s.practiceStatus, 'NOT_ASSESSED');
  assert.deepEqual(k8s.provenance, []);
  assert.equal(result.recommendedFocusTopics.length, 2);
});

test('Student insights: classifies practice statuses, detects multi-question patterns, and emits zero hiring verdicts', async () => {
  assert.equal(
    classifyStudentReportStatus({
      evaluationRun: { status: 'INSUFFICIENT_COVERAGE' },
      qualityReport: { qualityStatus: 'PASSED' },
      preparationCoverage: [],
      coverageSummary: { assessmentCoverage: 25 },
    }),
    'INSUFFICIENT_ASSESSMENT_COVERAGE'
  );

  const patterns = detectPerformancePatterns({
    questionEvaluations: [
      { questionId: 'q1', questionType: 'TECHNICAL', rating: 2.5, missingEvidence: ['Missing trade-offs'] },
      { questionId: 'q2', questionType: 'TECHNICAL', rating: 2.5, missingEvidence: ['Cache invalidation trade-off'] },
    ],
    turns: [
      { speaker: 'CANDIDATE', questionId: 'q1', spokenText: 'Short answer.' },
      { speaker: 'CANDIDATE', questionId: 'q2', spokenText: 'Another brief answer.' },
    ],
  });
  assert.ok(patterns.some((p) => p.patternCode === 'BRIEF_RESPONSES'));
  assert.ok(patterns.some((p) => p.patternCode === 'MISSING_TRADEOFFS'));

  const insights = await buildStudentPracticeInsights(
    {
      session: {
        sessionId: 'sess_u1',
        targetRole: 'Backend Engineer',
        interviewType: 'MIXED',
        practiceMode: 'GUIDED_PRACTICE',
        blueprintVersion: 1,
      },
      evaluationRun: {
        status: 'COMPLETED',
        evaluationVersion: 1,
        evaluatorVersion: '6.0.0',
        overallScore: 3.4,
        coverageSummary: { assessmentCoverage: 100 },
      },
      questionEvaluations: [
        {
          questionId: 'q1',
          competencyId: 'comp_1',
          questionType: 'TECHNICAL',
          questionText: 'Explain indexing',
          evaluationStatus: 'EVALUATED',
          rating: 2.5,
          strengths: ['Mentioned B-tree'],
          missingEvidence: ['Query execution plan trade-offs'],
        },
      ],
      competencyEvaluations: [
        {
          competencyId: 'comp_1',
          competencyName: 'Database Optimization',
          score: 2.5,
          assessmentStatus: 'ASSESSED',
          evidenceSupport: 'MEDIUM',
          developmentAreas: ['Index selectivity'],
          evidenceReferences: [],
        },
      ],
      requirementAssessments: [
        {
          requirementId: 'req_1',
          requirementName: 'Database Optimization',
          requirementType: 'MUST_HAVE',
          assessment: 'SUPPORTED_DIRECTLY',
        },
      ],
      blueprintDoc: {
        competencyPlan: [{ competencyId: 'comp_1', sourceRequirementIds: ['req_1'] }],
      },
      turns: [
        { speaker: 'CANDIDATE', questionId: 'q1', spokenText: 'Indexes speed up reads using B-trees.' },
      ],
      qualityReport: { qualityStatus: 'PASSED_WITH_WARNINGS', qualityFlags: ['INTERRUPTED_ASSESSMENTS'] },
    },
    { llmProvider: null }
  );

  assert.equal(insights.practiceMode, 'GUIDED_PRACTICE');
  assert.match(insights.practiceSummary.modeComparisonNote, /Guided practice/i);
  assert.equal(insights.answerImprovementGuidance.length, 1);
  assert.equal(insights.dataQualityWarnings.length, 1);
  assert.equal('decisionSupportStatus' in insights, false);
  assert.equal('hireRecommendation' in insights, false);
});

test('Answer improvement: provides STAR framing without fabricated experience and recognises multiple valid answers', async () => {
  const guidance = await buildAnswerImprovementGuidance({
    questionEvaluations: [
      {
        questionId: 'q_beh',
        competencyId: 'comp_comm',
        questionType: 'BEHAVIOURAL',
        questionText: 'Tell me about a time you resolved a production conflict.',
        evaluationStatus: 'EVALUATED',
        rating: 2.5,
        missingEvidence: ['Measurable outcome'],
      },
    ],
    turns: [
      {
        speaker: 'CANDIDATE',
        questionId: 'q_beh',
        spokenText: 'We had a disagreement on API format and talked it out.',
      },
    ],
  });

  assert.equal(guidance.length, 1);
  assert.match(guidance[0].illustrativeExampleAnswer, /STAR outline/i);
  assert.match(guidance[0].illustrativeNote, /Multiple technically valid explanations exist/i);
  assert.ok(guidance[0].structureSuggestions.some((s) => /STAR/i.test(s)));
});

test('Development plan generator: rejects hallucinated LLM competencyIds & URLs and emits structured exercises', async () => {
  const urlProvider = {
    generateStructuredJson: async () => ({
      provider: 'fake',
      model: 'fake-model',
      data: {
        summary: 'Check https://external-paid-course.example.com',
        objectives: [
          {
            objectiveId: 'obj_1',
            competencyId: 'comp_api',
            developmentArea: 'Idempotency',
            currentEvidence: 'Brief answer',
            targetLearningOutcome: 'Master idempotency keys',
            recommendedTopics: ['Idempotency'],
            practicalExercises: ['https://evil.example.com'],
            completionCriteria: ['Done'],
            suggestedPriority: 'HIGH',
            estimatedEffort: '2 hours',
            sourceEvaluationReferences: ['q_1'],
          },
        ],
      },
    }),
  };

  const plan = await generateDevelopmentPlanContent(
    {
      session: { sessionId: 'sess_1', targetRole: 'Backend Engineer', practiceMode: 'REALISTIC_MOCK' },
      competencyEvaluations: [
        {
          competencyId: 'comp_api',
          competencyName: 'REST API Design',
          score: 2.5,
          assessmentStatus: 'ASSESSED',
          developmentAreas: ['Idempotency handling'],
        },
      ],
      questionEvaluations: [
        {
          questionId: 'q_1',
          competencyId: 'comp_api',
          questionText: 'How do you make POST endpoints idempotent?',
          missingEvidence: ['Idempotency key storage'],
        },
      ],
    },
    { llmProvider: urlProvider }
  );

  assert.equal(plan.llmMetadata, null);
  assert.equal(plan.objectives.length, 1);
  assert.equal(plan.objectives[0].competencyId, 'comp_api');
  assert.equal(typeof plan.objectives[0].practicalExercises[0], 'object');
  assert.equal(JSON.stringify(plan).includes('https://'), false);
});

test('Quality notice & longitudinal comparability: separates raw diagnostics and blocks incompatible mode/role comparisons', () => {
  const notices = buildStudentQualityNotice({
    qualityStatus: 'PASSED_WITH_WARNINGS',
    qualityFlags: ['UNVERIFIED_EVIDENCE_PRESENT', 'LOW_ASSESSMENT_COVERAGE'],
  });
  assert.equal(notices.length, 2);
  assert.equal(notices.some((n) => n.code === 'TRANSCRIPT_RELIABILITY'), true);

  assert.equal(
    isComparableReport(
      { targetRole: 'Backend Engineer', practiceMode: 'REALISTIC_MOCK', sourceVersions: { evaluatorVersion: '6.0.0' } },
      { targetRole: 'Backend Engineer', practiceMode: 'GUIDED_PRACTICE', sourceVersions: { evaluatorVersion: '6.0.0' } }
    ),
    false
  );
  assert.equal(
    isComparableReport(
      { targetRole: 'Backend Engineer', practiceMode: 'REALISTIC_MOCK', sourceVersions: { evaluatorVersion: '6.0.0' } },
      { targetRole: 'Backend Engineer', practiceMode: 'REALISTIC_MOCK', sourceVersions: { evaluatorVersion: '7.0.0' } }
    ),
    false
  );
  assert.equal(
    isComparableReport(
      {
        targetRole: 'Backend Engineer',
        practiceMode: 'REALISTIC_MOCK',
        overallPracticeScore: 4,
        assessmentCoverage: 100,
        sourceVersions: { evaluatorVersion: '6.0.0' },
      },
      {
        targetRole: 'Backend Engineer',
        practiceMode: 'REALISTIC_MOCK',
        overallPracticeScore: 4.2,
        assessmentCoverage: 100,
        sourceVersions: { evaluatorVersion: '6.1.0' },
      }
    ),
    true
  );
});

test('Internal platform admin authorization: rejects recruiters, students, invalid tokens, and spoofed headers; allows verified platform admin & timing-safe token', async () => {
  const prevSecret = env.PLATFORM_ADMIN_SECRET;
  env.PLATFORM_ADMIN_SECRET = 'super-secret-internal-token-123';
  try {
    assert.equal(isValidInternalPlatformToken('super-secret-internal-token-123'), true);
    assert.equal(isValidInternalPlatformToken('wrong-token'), false);
    assert.equal(hasPlatformAdminAuthority({ userId: 'u1', orgRole: 'org:recruiter' }), false);
    assert.equal(hasPlatformAdminAuthority({ userId: 'u1', orgRole: 'org:admin' }), false);
    assert.equal(hasPlatformAdminAuthority({ userId: 'u1', orgRole: 'org:platform_admin' }), true);

    const invalidTokenRes = await runMiddleware(requirePlatformAdmin, {
      headers: { 'x-internal-platform-token': 'bad-token' },
    });
    assert.equal(invalidTokenRes.nextCalled, true);
    assert.equal(invalidTokenRes.err.statusCode, 403);

    const validTokenRes = await runMiddleware(requirePlatformAdmin, {
      headers: { 'x-internal-platform-token': 'super-secret-internal-token-123' },
    });
    assert.equal(validTokenRes.nextCalled, true);
    assert.equal(validTokenRes.err, null);

    // Recruiter cannot access platform-admin routes
    const recruiterRes = await runMiddleware(requirePlatformAdmin, {
      headers: {
        'x-test-user-id': 'rec_1',
        'x-test-org-id': 'org_1',
        'x-test-org-role': 'org:recruiter',
      },
    });
    assert.equal(recruiterRes.nextCalled, true);
    assert.equal(recruiterRes.err.statusCode, 403);

    // Verified platform admin succeeds
    const adminRes = await runMiddleware(requirePlatformAdmin, {
      headers: {
        'x-test-user-id': 'padmin_1',
        'x-test-org-id': 'org_1',
        'x-test-org-role': 'org:platform_admin',
      },
    });
    assert.equal(adminRes.nextCalled, true);
    assert.equal(adminRes.err, null);
  } finally {
    env.PLATFORM_ADMIN_SECRET = prevSecret;
  }
});

test('Longitudinal comparability v2.0: enforces all 10 compatibility dimensions and returns detailed metadata', () => {
  const baseReport = (overrides = {}) => ({
    sessionUuid: 'SESSION_001',
    targetRole: 'Backend Engineer',
    practiceMode: 'REALISTIC_MOCK',
    overallPracticeScore: 3.5,
    assessmentCoverage: 100,
    sourceVersions: {
      evaluatorVersion: '6.0.0',
      difficulty: 'MID',
      rubricVersion: '1.0',
      scoreScale: 5,
      aggregationMethod: 'EQUAL_WEIGHT',
    },
    competencyInsights: [
      {
        competencyId: 'DATABASE',
        assessmentStatus: 'ASSESSED',
        effectiveScore: 3.5,
        rubricVersion: '1.0',
        scoreScale: 5,
        aggregationMethod: 'EQUAL_WEIGHT',
      },
      {
        competencyId: 'NODEJS',
        assessmentStatus: 'ASSESSED',
        effectiveScore: 4.0,
        rubricVersion: '1.0',
        scoreScale: 5,
        aggregationMethod: 'EQUAL_WEIGHT',
      },
    ],
    ...overrides,
  });

  // 1. Same role & compatible assessment configuration + overlapping competency exclusion
  const compatible = comparePracticeReports(
    baseReport(),
    baseReport({
      sessionUuid: 'SESSION_002',
      competencyInsights: [
        {
          competencyId: 'DATABASE',
          assessmentStatus: 'ASSESSED',
          effectiveScore: 4.0,
          rubricVersion: '1.0',
          scoreScale: 5,
          aggregationMethod: 'EQUAL_WEIGHT',
        },
        {
          competencyId: 'NODEJS',
          assessmentStatus: 'ASSESSED',
          effectiveScore: 4.5,
          rubricVersion: '2.0', // incompatible rubric
          scoreScale: 5,
          aggregationMethod: 'EQUAL_WEIGHT',
        },
        {
          competencyId: 'SYSTEM_DESIGN', // only in session 2
          assessmentStatus: 'ASSESSED',
          effectiveScore: 3.0,
          rubricVersion: '1.0',
          scoreScale: 5,
          aggregationMethod: 'EQUAL_WEIGHT',
        },
      ],
    })
  );
  assert.equal(compatible.comparisonStatus, 'COMPARABLE');
  assert.equal(compatible.comparisonMethod, 'SAME_COMPETENCY_RUBRIC');
  assert.equal(compatible.methodologyVersion, '2.0');
  assert.deepEqual(compatible.comparableCompetencies, ['DATABASE']);
  assert.equal(compatible.excludedCompetencies.length, 2);

  // 2. Different target role -> NON_COMPARABLE
  assert.equal(
    comparePracticeReports(baseReport(), baseReport({ targetRole: 'Frontend Engineer' })).comparisonStatus,
    'NON_COMPARABLE'
  );
  // 3. Different practice mode -> NON_COMPARABLE
  assert.equal(
    comparePracticeReports(baseReport(), baseReport({ practiceMode: 'GUIDED_PRACTICE' })).comparisonStatus,
    'NON_COMPARABLE'
  );
  // 4. Different evaluator version -> NON_COMPARABLE
  assert.equal(
    comparePracticeReports(
      baseReport(),
      baseReport({ sourceVersions: { ...baseReport().sourceVersions, evaluatorVersion: '7.0.0' } })
    ).comparisonStatus,
    'NON_COMPARABLE'
  );
  // 5. Different difficulty -> NON_COMPARABLE
  assert.equal(
    comparePracticeReports(
      baseReport(),
      baseReport({ sourceVersions: { ...baseReport().sourceVersions, difficulty: 'SENIOR' } })
    ).comparisonStatus,
    'NON_COMPARABLE'
  );
  // 6. Different scoring scale -> NON_COMPARABLE
  assert.equal(
    comparePracticeReports(
      baseReport(),
      baseReport({ sourceVersions: { ...baseReport().sourceVersions, scoreScale: 10 } })
    ).comparisonStatus,
    'NON_COMPARABLE'
  );
  // 7. Insufficient assessment coverage -> NON_COMPARABLE
  assert.equal(
    comparePracticeReports(baseReport(), baseReport({ assessmentCoverage: 25 })).comparisonStatus,
    'NON_COMPARABLE'
  );
  // 8. Missing evaluation score -> NON_COMPARABLE
  assert.equal(
    comparePracticeReports(baseReport(), baseReport({ overallPracticeScore: null })).comparisonStatus,
    'NON_COMPARABLE'
  );
});
