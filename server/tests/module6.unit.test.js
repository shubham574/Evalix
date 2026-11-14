const { describe, it } = require('node:test');
const assert = require('node:assert');

const { validateSessionForEvaluation } = require('../modules/interview-evaluation/assembly/transcript-validator');
const { assembleQuestionResponses } = require('../modules/interview-evaluation/assembly/question-response-assembler');
const { validateEvidenceReferences } = require('../modules/interview-evaluation/evidence/evidence-validator');
const { classifyEvidenceSupport } = require('../modules/interview-evaluation/evidence/evidence-quality.service');
const { aggregateCompetencies } = require('../modules/interview-evaluation/scoring/competency-scorer');
const { calculateCoverage } = require('../modules/interview-evaluation/scoring/coverage-calculator');
const { calculateOverallScore } = require('../modules/interview-evaluation/scoring/overall-scorer');

describe('Module 6 Unit Tests — Assembly, Evidence Validation, Rubric & Deterministic Scoring', () => {
  it('rejects non-terminal sessions and blueprint version mismatches', () => {
    assert.throws(
      () =>
        validateSessionForEvaluation({
          session: { _id: 's1', status: 'IN_PROGRESS', blueprintVersion: 1 },
          blueprintDoc: { blueprintVersion: 1 },
          turns: [],
        }),
      /not eligible for evaluation/
    );

    assert.throws(
      () =>
        validateSessionForEvaluation({
          session: { _id: 's1', status: 'COMPLETED', blueprintVersion: 1 },
          blueprintDoc: { blueprintVersion: 2 },
          turns: [],
        }),
      /Blueprint version mismatch/
    );
  });

  it('groups follow-ups and detects interviewer-supplied guidance', () => {
    const blueprint = {
      questionPlan: [
        {
          questionId: 'q1',
          stageId: 'stg_1',
          competencyId: 'comp_1',
          questionText: 'How does JWT work?',
        },
        {
          questionId: 'q2',
          stageId: 'stg_1',
          competencyId: 'comp_1',
          questionText: 'Unasked question',
        },
      ],
    };
    const session = {
      askedQuestionIds: ['q1'],
      completedQuestionIds: ['q1'],
      stageProgress: [{ stageId: 'stg_1', status: 'COMPLETED' }],
    };
    const turns = [
      { _id: 't1', turnNumber: 1, speaker: 'AI', turnType: 'CORE_QUESTION', questionId: 'q1', spokenText: 'How does JWT work?' },
      { _id: 't2', turnNumber: 2, speaker: 'CANDIDATE', turnType: 'CANDIDATE_ANSWER', questionId: 'q1', spokenText: 'It uses signed tokens.', transcriptStatus: 'FINAL' },
      { _id: 't3', turnNumber: 3, speaker: 'AI', turnType: 'FOLLOW_UP', questionId: 'q1', spokenText: 'Hint: consider expiration.' },
      { _id: 't4', turnNumber: 4, speaker: 'CANDIDATE', turnType: 'CANDIDATE_ANSWER', questionId: 'q1', spokenText: 'We set exp claim.', transcriptStatus: 'FINAL' },
    ];

    const assembled = assembleQuestionResponses({ session, internalBlueprint: blueprint, validTurns: turns });
    assert.strictEqual(assembled[0].candidateTurns.length, 2);
    assert.strictEqual(assembled[0].promptingContext, 'HINT_SUPPORTED');
    assert.strictEqual(assembled[1].wasAsked, false);
  });

  it('verifies exact candidate quotes and rejects hallucinated or interviewer-turn quotes', () => {
    const candidateTurns = [
      { turnId: 'turn_cand_1', turnNumber: 2, spokenText: 'I used JWT middleware to protect the APIs.', timestamp: new Date() },
    ];
    const { verifiedEvidence, unverifiedEvidence } = validateEvidenceReferences({
      candidateTurns,
      proposedReferences: [
        { turnId: 'turn_cand_1', quote: 'I used JWT middleware to protect the APIs.' },
        { turnId: 'turn_cand_1', quote: 'I used JWT middleware to protect the APIs.' }, // duplicate
        { turnId: 'turn_cand_1', quote: 'I built a Kafka cluster from scratch.' }, // hallucinated
        { turnId: 'turn_ai_99', quote: 'How does JWT work?' }, // interviewer / wrong turnId
      ],
    });

    assert.strictEqual(verifiedEvidence.length, 1);
    assert.strictEqual(unverifiedEvidence.length, 2);

    const quality = classifyEvidenceSupport({
      verifiedEvidence,
      unverifiedEvidence,
      criterionEvaluations: [{ status: 'DEMONSTRATED' }],
      promptingContext: 'UNPROMPTED',
    });
    assert.strictEqual(quality.evidenceSupport, 'LOW');
    assert.ok(quality.reviewFlags.includes('UNVERIFIED_EVIDENCE'));
  });

  it('aggregates competency scores deterministically and keeps NOT_ASSESSED as null', () => {
    const blueprint = {
      competencies: [
        { competencyId: 'comp_node', name: 'Node.js', weight: 0.6 },
        { competencyId: 'comp_sys', name: 'System Design', weight: 0.4 },
      ],
    };
    const questionAssemblies = [
      { questionId: 'q1', competencyId: 'comp_node', weight: null },
      { questionId: 'q2', competencyId: 'comp_node', weight: null },
      { questionId: 'q3', competencyId: 'comp_sys', weight: null },
    ];
    const questionEvaluations = [
      { questionId: 'q1', competencyId: 'comp_node', evaluationStatus: 'EVALUATED', rating: 4, ratingLabel: 'STRONG', evidenceSupport: 'HIGH', reviewRequired: false },
      { questionId: 'q2', competencyId: 'comp_node', evaluationStatus: 'EVALUATED', rating: 5, ratingLabel: 'EXCELLENT', evidenceSupport: 'HIGH', reviewRequired: false },
      { questionId: 'q3', competencyId: 'comp_sys', evaluationStatus: 'NOT_ASKED', rating: null, ratingLabel: null, evidenceSupport: 'INSUFFICIENT', reviewRequired: false },
    ];

    const comps = aggregateCompetencies({ internalBlueprint: blueprint, questionEvaluations, questionAssemblies });
    assert.strictEqual(comps[0].score, 4.5);
    assert.strictEqual(comps[0].assessmentStatus, 'ASSESSED');
    assert.strictEqual(comps[1].score, null);
    assert.strictEqual(comps[1].assessmentStatus, 'NOT_ASSESSED');

    const coverage = calculateCoverage({ questionEvaluations });
    assert.strictEqual(coverage.evaluatedQuestions, 2);
    assert.strictEqual(coverage.notAssessedQuestions, 1);

    const overall = calculateOverallScore({ competencyEvaluations: comps, coverageSummary: coverage, questionEvaluations });
    assert.strictEqual(overall.overallScore, 4.5);
    assert.strictEqual(overall.overallStatus, 'PROVISIONAL');
  });

  it('returns null overallScore when weights are invalid or coverage is insufficient', () => {
    const badWeightsOverall = calculateOverallScore({
      competencyEvaluations: [{ competencyId: 'c1', weight: 0.3, score: 4 }],
      coverageSummary: { assessmentCoverage: 100 },
      questionEvaluations: [],
    });
    assert.strictEqual(badWeightsOverall.overallScore, null);
    assert.strictEqual(badWeightsOverall.overallStatus, 'INVALID_OR_MISSING_WEIGHTS');

    const lowCoverageOverall = calculateOverallScore({
      competencyEvaluations: [{ competencyId: 'c1', weight: 1.0, score: 4 }],
      coverageSummary: { assessmentCoverage: 20 },
      questionEvaluations: [],
    });
    assert.strictEqual(lowCoverageOverall.overallScore, null);
    assert.strictEqual(lowCoverageOverall.overallStatus, 'INSUFFICIENT_COVERAGE');
  });
});
