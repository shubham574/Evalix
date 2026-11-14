const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  classifyRoleFamily,
  resolveTargetDifficulty,
} = require('../modules/interview-blueprint/templates/interview-template.registry');
const { buildCompetencyPlan } = require('../modules/interview-blueprint/planner/competency-planner');
const { planStages } = require('../modules/interview-blueprint/planner/stage-planner');
const {
  generateQuestionsForBlueprint,
  deduplicateQuestions,
} = require('../modules/interview-blueprint/question-engine/question-generator');
const { generateRubricsForQuestions } = require('../modules/interview-blueprint/assessment/rubric-generator');
const { validateBlueprint } = require('../modules/interview-blueprint/validation/blueprint.validator');
const {
  toCandidateFacingBlueprint,
  toCandidateFacingQuestions,
  toInternalOrchestratorBlueprint,
} = require('../modules/interview-blueprint/serializers/blueprint.serializer');

describe('Module 4: Unit Tests (Competency, Stages, Time, Questions, Rubrics, Validation, Serialization)', () => {
  it('7-16. Role-family classification, MUST_HAVE vs PREFERRED, overlapping deduplication & excluded tracking', () => {
    assert.strictEqual(classifyRoleFamily('Backend Developer').family, 'SOFTWARE_ENGINEERING');
    assert.strictEqual(classifyRoleFamily('Frontend Developer').family, 'SOFTWARE_ENGINEERING');
    assert.strictEqual(classifyRoleFamily('Sales Executive').family, 'BUSINESS');
    assert.strictEqual(classifyRoleFamily('Sales Executive').practicalMode, 'ROLE_PLAY_AND_SCENARIO');
    assert.strictEqual(classifyRoleFamily('Data Analyst').family, 'ANALYTICS');
    assert.strictEqual(classifyRoleFamily('Growth Marketing Manager').family, 'BUSINESS');
    assert.strictEqual(classifyRoleFamily('UI/UX Designer').family, 'DESIGN');
    assert.strictEqual(classifyRoleFamily('Engineering Manager').family, 'SOFTWARE_ENGINEERING');
    assert.strictEqual(classifyRoleFamily('Product Manager').family, 'MANAGEMENT');

    const { competencies, excludedRequirements } = buildCompetencyPlan({
      durationMinutes: 15, // caps at 3 competencies
      interviewType: 'MIXED',
      seniorityLevel: 'SENIOR',
      requirements: [
        { requirementId: 'R1', normalizedName: 'Node.js', category: 'TECHNICAL', requirementType: 'MUST_HAVE' },
        { requirementId: 'R2', normalizedName: 'Node.js', category: 'TECHNICAL', requirementType: 'MUST_HAVE' }, // overlap
        { requirementId: 'R3', normalizedName: 'PostgreSQL', category: 'TECHNICAL', requirementType: 'MUST_HAVE' },
        { requirementId: 'R4', normalizedName: 'Communication', category: 'BEHAVIOURAL', requirementType: 'MUST_HAVE' },
        { requirementId: 'R5', normalizedName: 'GraphQL', category: 'TECHNICAL', requirementType: 'PREFERRED' },
      ],
      assessments: [
        { requirementId: 'R3', assessment: 'NOT_EVIDENCED', verificationNeeded: false },
      ],
    });

    assert.strictEqual(competencies.length, 3);
    assert.strictEqual(competencies[0].sourceRequirementIds.length >= 1, true);
    assert.strictEqual(excludedRequirements.length, 1);
    assert.strictEqual(excludedRequirements[0].name, 'GraphQL');
  });

  it('31-38. Time allocation sums exactly to configured duration across 15, 30, 45, 60, and 90 min', () => {
    for (const mins of [15, 30, 45, 60, 90]) {
      const plan = planStages({
        targetRole: 'Backend Engineer',
        interviewType: 'MIXED',
        durationMinutes: mins,
        competencies: [],
      });
      const sum = plan.stages.reduce((s, st) => s + st.durationSeconds, 0);
      assert.strictEqual(plan.totalDurationSeconds, mins * 60);
      assert.strictEqual(sum, mins * 60, `Expected exact stage sum for ${mins}m`);
    }
  });

  it('17-30. Generates core & personalised questions, rejects hallucinated fact refs, deduplicates, builds 5-level rubrics & validates', async () => {
    assert.strictEqual(resolveTargetDifficulty('FRESHER'), 'FOUNDATIONAL');
    assert.strictEqual(resolveTargetDifficulty('JUNIOR'), 'BASIC');
    assert.strictEqual(resolveTargetDifficulty('MID'), 'INTERMEDIATE');
    assert.strictEqual(resolveTargetDifficulty('SENIOR'), 'ADVANCED');

    const { competencies, excludedRequirements } = buildCompetencyPlan({
      durationMinutes: 45,
      interviewType: 'MIXED',
      seniorityLevel: 'MID',
      requirements: [
        { requirementId: 'R_NODE', normalizedName: 'Node.js', category: 'TECHNICAL', requirementType: 'MUST_HAVE' },
        { requirementId: 'R_COMM', normalizedName: 'Ownership', category: 'BEHAVIOURAL', requirementType: 'MUST_HAVE' },
      ],
      assessments: [],
    });

    const stagePlan = planStages({
      targetRole: 'Backend Developer',
      interviewType: 'MIXED',
      durationMinutes: 45,
      competencies,
    });

    const reviewedFacts = [
      {
        factId: 'FACT_PROJ_1',
        factType: 'PROJECT',
        value: 'Stripe Payment Gateway',
        sourceType: 'RESUME_EXTRACTED',
        evidenceIds: ['EVD_1'],
      },
    ];

    const fakeLlm = {
      generateStructuredJson: async () => ({
        provider: 'fake',
        model: 'fake-model',
        usage: { totalTokens: 50 },
        data: {
          schemaVersion: '1.0',
          questions: [
            {
              questionKey: 'Q_001',
              questionText: 'How does the Node.js event loop handle non-blocking I/O in production?',
              purpose: 'Assess Node.js event loop fundamentals.',
              candidateFactReferences: ['FACT_HALLUCINATED'], // should be rejected
              evidenceReferences: ['EVD_FAKE'],
              expectedEvidence: ['Event loop phases', 'Non-blocking I/O'],
              allowedProbeTypes: ['CLARIFICATION', 'DEEP_DIVE'],
            },
          ],
        },
      }),
    };

    const qRes = await generateQuestionsForBlueprint({
      competencies,
      stages: stagePlan.stages,
      reviewedFacts,
      targetRole: 'Backend Developer',
      seniorityLevel: 'MID',
      practicalMode: stagePlan.practicalMode,
      llmProvider: fakeLlm,
    });

    assert.ok(qRes.warnings.some((w) => w.includes('FACT_HALLUCINATED')));
    assert.ok(qRes.questions.some((q) => q.consistencyClass === 'CORE_ASSESSMENT'));
    assert.ok(
      qRes.questions.some(
        (q) =>
          q.consistencyClass === 'PERSONALISED_ASSESSMENT' &&
          q.candidateFactReferences.includes('FACT_PROJ_1')
      )
    );

    // Deduplicator test
    const dupes = deduplicateQuestions([qRes.questions[0], { ...qRes.questions[0], questionId: 'Q_DUP' }]);
    assert.strictEqual(dupes.length, 1);

    const rubrics = generateRubricsForQuestions({ questions: qRes.questions, competencies });
    assert.strictEqual(rubrics.length, qRes.questions.length);
    for (const r of rubrics) {
      assert.strictEqual(r.ratingDescriptors.length, 5);
    }

    const val = validateBlueprint({
      totalDurationSeconds: stagePlan.totalDurationSeconds,
      stages: stagePlan.stages,
      competencyPlan: competencies,
      excludedRequirements,
      questions: qRes.questions,
      evaluationRubrics: rubrics,
      reviewedFacts,
      jobRequirements: [
        { requirementId: 'R_NODE', normalizedName: 'Node.js', requirementType: 'MUST_HAVE' },
        { requirementId: 'R_COMM', normalizedName: 'Ownership', requirementType: 'MUST_HAVE' },
      ],
    });
    assert.strictEqual(val.isValid, true);

    // 37. Over-budget question rejection
    const overBudget = validateBlueprint({
      totalDurationSeconds: stagePlan.totalDurationSeconds,
      stages: stagePlan.stages,
      competencyPlan: competencies,
      excludedRequirements,
      questions: [{ ...qRes.questions[0], expectedResponseSeconds: 900 }],
      evaluationRubrics: rubrics,
      reviewedFacts,
      jobRequirements: [],
    });
    assert.strictEqual(overBudget.isValid, false);
    assert.ok(overBudget.errors.some((e) => e.includes('exceeds stage duration')));

    // 28. Invalid rubric rejection (missing rating 5)
    const badRubric = {
      ...rubrics[0],
      ratingDescriptors: rubrics[0].ratingDescriptors.slice(0, 4),
    };
    const invalidRubricVal = validateBlueprint({
      totalDurationSeconds: stagePlan.totalDurationSeconds,
      stages: stagePlan.stages,
      competencyPlan: competencies,
      excludedRequirements,
      questions: qRes.questions,
      evaluationRubrics: [badRubric, ...rubrics.slice(1)],
      reviewedFacts,
      jobRequirements: [],
    });
    assert.strictEqual(invalidRubricVal.isValid, false);
  });

  it('39. Candidate-facing serializers strip private rubrics, misconceptions, and internal triggers', () => {
    const bp = {
      _id: 'BP_1',
      blueprintVersion: 1,
      intakeId: 'INT_1',
      candidateProfileId: 'CP_1',
      candidateAnalysisId: 'AN_1',
      status: 'READY',
      interviewType: 'MIXED',
      targetRole: 'Backend Engineer',
      seniorityLevel: 'MID',
      totalDurationSeconds: 2700,
      stages: [{ stageId: 'S1', stageName: 'Tech', stageType: 'TECHNICAL_ASSESSMENT', objective: 'Obj', durationSeconds: 1000, order: 1 }],
      competencyPlan: [{ competencyId: 'C1', name: 'Node.js', category: 'TECHNICAL' }],
      questionPlan: [
        {
          questionId: 'Q1',
          stageId: 'S1',
          questionType: 'TECHNICAL_CONCEPT',
          questionCategory: 'CORE',
          consistencyClass: 'CORE_ASSESSMENT',
          questionText: 'Explain event loop',
          candidateVisible: true,
          difficulty: 'INTERMEDIATE',
          expectedResponseSeconds: 120,
          thinkingAllowanceSeconds: 15,
          followUpPolicy: { enabled: true, triggerCondition: 'PRIVATE_SECRET' },
          candidateFactReferences: ['FACT_1'],
        },
      ],
      evaluationRubrics: [{ rubricId: 'R1', criticalMisconceptions: ['SECRET_MISCONCEPTION'] }],
    };

    const candBp = JSON.stringify(toCandidateFacingBlueprint(bp));
    const candQs = JSON.stringify(toCandidateFacingQuestions(bp));
    assert.ok(!candBp.includes('SECRET_MISCONCEPTION'));
    assert.ok(!candBp.includes('evaluationRubrics'));
    assert.ok(!candQs.includes('PRIVATE_SECRET'));
    assert.ok(!candQs.includes('FACT_1'));

    const internal = toInternalOrchestratorBlueprint(bp);
    assert.strictEqual(internal.evaluationRubrics.length, 1);
    assert.ok(internal.followUpPolicies.Q1);
  });
});
