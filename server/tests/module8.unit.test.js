const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  buildFocusedPracticeSnapshot,
  getEffectiveBlueprintForSession,
} = require('../modules/interview-orchestrator/practice/focused-practice.service');
const {
  assembleQuestionResponses,
} = require('../modules/interview-evaluation/assembly/question-response-assembler');
const {
  calculateCoverage,
} = require('../modules/interview-evaluation/scoring/coverage-calculator');
const {
  calculateOverallScore,
} = require('../modules/interview-evaluation/scoring/overall-scorer');
const {
  comparePracticeReports,
} = require('../modules/decision-intelligence/coaching/longitudinal-progress.service');
const {
  toCandidateSession,
} = require('../modules/interview-orchestrator/serializers/session.serializer');

const sampleBlueprint = {
  interviewType: 'TECHNICAL',
  targetRole: 'Backend Node.js Engineer',
  seniorityLevel: 'MID',
  totalDurationSeconds: 1800,
  competencies: [
    { competencyId: 'comp_node', name: 'Node.js Runtime', weight: 0.6 },
    { competencyId: 'comp_db', name: 'Database Design', weight: 0.4 },
  ],
  stagePlan: [
    { stageId: 'stg_tech_1', stageType: 'TECHNICAL', title: 'Backend Core', durationSeconds: 900 },
    { stageId: 'stg_tech_2', stageType: 'TECHNICAL', title: 'Databases', durationSeconds: 900 },
  ],
  questionPlan: [
    { questionId: 'q_1', stageId: 'stg_tech_1', competencyId: 'comp_node', prompt: 'Explain event loop' },
    { questionId: 'q_2', stageId: 'stg_tech_1', competencyId: 'comp_node', prompt: 'Explain streams' },
    { questionId: 'q_3', stageId: 'stg_tech_2', competencyId: 'comp_db', prompt: 'Explain indexing' },
  ],
};

describe('Module 8 Unit Tests — Guided & Focused Practice Policies', () => {
  it('buildFocusedPracticeSnapshot filters questions strictly without mutating blueprint', () => {
    const beforeCount = sampleBlueprint.questionPlan.length;
    const { executionSnapshot } = buildFocusedPracticeSnapshot({
      internalBlueprint: sampleBlueprint,
      competencyId: 'comp_node',
      maxQuestions: 1,
    });

    assert.strictEqual(sampleBlueprint.questionPlan.length, beforeCount);
    assert.strictEqual(executionSnapshot.focusedCompetencyId, 'comp_node');
    assert.strictEqual(executionSnapshot.questionPlan.length, 1);
    assert.strictEqual(executionSnapshot.questionPlan[0].questionId, 'q_1');
    assert.deepStrictEqual(executionSnapshot.excludedQuestionIds, ['q_2', 'q_3']);
    assert.strictEqual(executionSnapshot.stagePlan.length, 1);
    assert.strictEqual(executionSnapshot.stagePlan[0].stageId, 'stg_tech_1');
  });

  it('buildFocusedPracticeSnapshot rejects invalid or missing competencyId without fallback', () => {
    assert.throws(
      () =>
        buildFocusedPracticeSnapshot({
          internalBlueprint: sampleBlueprint,
          competencyId: 'comp_nonexistent',
        }),
      (err) => err.statusCode === 400
    );
    assert.throws(
      () =>
        buildFocusedPracticeSnapshot({
          internalBlueprint: sampleBlueprint,
          competencyId: '',
        }),
      (err) => err.statusCode === 400
    );
  });

  it('getEffectiveBlueprintForSession overlays snapshot only for FOCUSED_SKILL_PRACTICE', () => {
    const { executionSnapshot } = buildFocusedPracticeSnapshot({
      internalBlueprint: sampleBlueprint,
      competencyId: 'comp_db',
    });

    const focusedView = getEffectiveBlueprintForSession(
      { practiceMode: 'FOCUSED_SKILL_PRACTICE', executionSnapshot },
      sampleBlueprint
    );
    assert.strictEqual(focusedView.questionPlan.length, 1);
    assert.strictEqual(focusedView.questionPlan[0].questionId, 'q_3');

    const mockView = getEffectiveBlueprintForSession(
      { practiceMode: 'REALISTIC_MOCK', executionSnapshot },
      sampleBlueprint
    );
    assert.strictEqual(mockView.questionPlan.length, 3);
  });

  it('Module 6 scoped evaluation excludes non-focused questions and omits misleading overall score', () => {
    const session = {
      practiceMode: 'FOCUSED_SKILL_PRACTICE',
      focusedCompetencyId: 'comp_node',
      askedQuestionIds: ['q_1', 'q_2'],
      completedQuestionIds: ['q_1', 'q_2'],
      stageProgress: [],
    };
    const assemblies = assembleQuestionResponses({
      session,
      internalBlueprint: sampleBlueprint,
      validTurns: [],
      invalidTurns: [],
    });

    const q3 = assemblies.find((a) => a.questionId === 'q_3');
    assert.strictEqual(q3.excludedByStage, true);
    assert.strictEqual(q3.wasAsked, false);

    const questionEvaluations = [
      { questionId: 'q_1', competencyId: 'comp_node', evaluationStatus: 'EVALUATED', rating: 4 },
      { questionId: 'q_2', competencyId: 'comp_node', evaluationStatus: 'EVALUATED', rating: 4 },
      { questionId: 'q_3', competencyId: 'comp_db', evaluationStatus: 'EXCLUDED_BY_SESSION_POLICY', rating: null },
    ];
    const coverageSummary = calculateCoverage({ questionEvaluations });
    assert.strictEqual(coverageSummary.excludedQuestions, 1);
    assert.strictEqual(coverageSummary.assessmentCoverage, 100);

    const overall = calculateOverallScore({
      competencyEvaluations: [
        { competencyId: 'comp_node', weight: 0.6, score: 4 },
        { competencyId: 'comp_db', weight: 0.4, score: null },
      ],
      coverageSummary,
      questionEvaluations,
      practiceMode: 'FOCUSED_SKILL_PRACTICE',
    });
    assert.strictEqual(overall.overallScore, null);
    assert.strictEqual(overall.overallStatus, 'FOCUSED_PRACTICE_SCOPED');
  });

  it('Module 7 longitudinal comparison allows matching focusedCompetencyId and blocks mismatched ones', () => {
    const baseReport = {
      sessionUuid: 'sess_1',
      targetRole: 'Backend Node.js Engineer',
      practiceMode: 'FOCUSED_SKILL_PRACTICE',
      focusedCompetencyId: 'comp_node',
      overallPracticeScore: null,
      assessmentCoverage: 100,
      sourceVersions: {
        evaluatorVersion: '6.0.0',
        difficulty: 'MID',
        scoreScale: 5,
        aggregationMethod: 'EQUAL_WEIGHT',
      },
      competencyInsights: [
        { competencyId: 'comp_node', competencyName: 'Node.js Runtime', assessmentStatus: 'ASSESSED', effectiveScore: 3.5 },
        { competencyId: 'comp_db', competencyName: 'Database Design', assessmentStatus: 'NOT_ASSESSED', effectiveScore: null },
      ],
    };
    const report2Same = {
      ...baseReport,
      sessionUuid: 'sess_2',
      competencyInsights: [
        { competencyId: 'comp_node', competencyName: 'Node.js Runtime', assessmentStatus: 'ASSESSED', effectiveScore: 4.5 },
        { competencyId: 'comp_db', competencyName: 'Database Design', assessmentStatus: 'NOT_ASSESSED', effectiveScore: null },
      ],
    };
    const report2DifferentComp = {
      ...baseReport,
      sessionUuid: 'sess_3',
      focusedCompetencyId: 'comp_db',
    };

    const comparable = comparePracticeReports(baseReport, report2Same);
    assert.strictEqual(comparable.comparisonStatus, 'COMPARABLE');
    assert.strictEqual(comparable.comparableCompetencies.length, 1);
    assert.strictEqual(comparable.comparableCompetencies[0], 'comp_node');

    const nonComparable = comparePracticeReports(baseReport, report2DifferentComp);
    assert.strictEqual(nonComparable.comparisonStatus, 'NON_COMPARABLE');
  });

  it('toCandidateSession exposes student-safe practiceMode fields without internal rubric/prompts', () => {
    const serialized = toCandidateSession({
      _id: '507f1f77bcf86cd799439011',
      sessionId: 'sess_abc',
      intakeId: '507f1f77bcf86cd799439012',
      blueprintId: '507f1f77bcf86cd799439013',
      blueprintVersion: 1,
      interviewType: 'TECHNICAL',
      practiceMode: 'GUIDED_PRACTICE',
      targetRole: 'Backend Engineer',
      seniorityLevel: 'MID',
      status: 'IN_PROGRESS',
      totalDurationSeconds: 1800,
      executionSnapshot: { maxHintsPerQuestion: 3, maxAttemptsPerQuestion: 3 },
      guidedState: { currentQuestionId: 'q_1', currentAttemptCount: 1, hintsUsedForCurrentQuestion: 2, awaitingContinue: true },
    });

    assert.strictEqual(serialized.practiceMode, 'GUIDED_PRACTICE');
    assert.strictEqual(serialized.guidedState.currentQuestionId, 'q_1');
    assert.strictEqual(serialized.executionSnapshot, undefined);
  });
});
