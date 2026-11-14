const env = require('../../../config/env');

const generateReports = ({
  run,
  session,
  questionEvaluations = [],
  competencyEvaluations = [],
  coverageSummary = {},
  overallSummary = {},
}) => {
  const strengths = Array.from(
    new Set(competencyEvaluations.flatMap((c) => c.strengths || []))
  ).slice(0, 10);

  const developmentAreas = Array.from(
    new Set(competencyEvaluations.flatMap((c) => c.developmentAreas || []))
  ).slice(0, 10);

  const reviewFlags = Array.from(
    new Set(questionEvaluations.flatMap((q) => q.reviewFlags || []))
  );
  const reviewRequired =
    questionEvaluations.some((q) => q.reviewRequired) ||
    overallSummary.overallStatus !== 'VALID';

  const skippedStages = (session.stageProgress || [])
    .filter((s) => s.status === 'SKIPPED')
    .map((s) => ({ stageId: s.stageId, title: s.title }));

  const recruiterReport = {
    overview: {
      sessionId: session.sessionId,
      intakeId: String(session.intakeId),
      candidateProfileId: String(session.candidateProfileId),
      targetRole: session.targetRole,
      seniorityLevel: session.seniorityLevel,
      interviewType: session.interviewType,
      interviewDate: session.startedAt || session.createdAt,
      activeDurationSeconds: session.activeDurationSeconds || 0,
      interviewStatus: session.status,
      blueprintVersion: session.blueprintVersion,
      evaluationVersion: run.evaluationVersion,
      evaluatorVersion: run.evaluatorVersion,
    },
    overallAssessment: {
      ...overallSummary,
      assessmentCoverage: coverageSummary.assessmentCoverage,
      evaluationStatus: run.status,
      reviewRequired,
      reviewStatus: run.reviewStatus || 'PENDING_REVIEW',
    },
    competencyBreakdown: competencyEvaluations.map((c) => ({
      competencyId: c.competencyId,
      competencyName: c.competencyName,
      weight: c.weight,
      score: c.score,
      scoreScale: c.scoreScale,
      assessmentStatus: c.assessmentStatus,
      aggregationMethod: c.aggregationMethod,
      evidenceSupport: c.evidenceSupport,
      coverage: c.coverage,
      questionScores: c.questionScores,
      strengths: c.strengths,
      developmentAreas: c.developmentAreas,
      evidenceReferences: c.evidenceReferences,
      humanOverride: c.humanOverride || null,
    })),
    questionResults: questionEvaluations.map((q) => ({
      questionId: q.questionId,
      competencyId: q.competencyId,
      rubricId: q.rubricId,
      questionText: q.questionText,
      questionType: q.questionType,
      evaluationStatus: q.evaluationStatus,
      rating: q.rating,
      ratingLabel: q.ratingLabel,
      evidenceSupport: q.evidenceSupport,
      promptingContext: q.promptingContext,
      criterionEvaluations: q.criterionEvaluations,
      evidenceReferences: q.evidenceReferences,
      unverifiedEvidenceReferences: q.unverifiedEvidenceReferences,
      missingEvidence: q.missingEvidence,
      explanation: q.explanation,
      reviewRequired: q.reviewRequired,
      reviewFlags: q.reviewFlags,
      humanOverride: q.humanOverride || null,
    })),
    keyStrengths: strengths,
    developmentAreas,
    interviewCompleteness: {
      ...coverageSummary,
      skippedStages,
      terminationReason: session.terminationReason || null,
    },
    reviewRequirements: {
      reviewRequired,
      reviewFlags,
    },
    humanReview: {
      advisoryOnly: true,
      automatedDecisionMade: false,
      reviewStatus: run.reviewStatus || 'PENDING_REVIEW',
    },
  };

  const exposeScores = env.INTERVIEW_EVALUATION_EXPOSE_CANDIDATE_SCORES;
  const candidateReport = {
    overview: {
      sessionId: session.sessionId,
      targetRole: session.targetRole,
      interviewType: session.interviewType,
      interviewDate: session.startedAt || session.createdAt,
      activeDurationSeconds: session.activeDurationSeconds || 0,
      interviewStatus: session.status,
    },
    overallFeedback: {
      summary:
        overallSummary.overallStatus === 'INSUFFICIENT_COVERAGE'
          ? 'Your interview was partially completed. Feedback below reflects only the topics assessed.'
          : 'Thank you for completing your interview. Below is a summary of your assessed strengths and growth areas.',
      ...(exposeScores && overallSummary.overallScore !== null
        ? {
            overallScore: overallSummary.overallScore,
            scoreScale: overallSummary.scoreScale,
          }
        : {}),
      assessedQuestionsCount: coverageSummary.evaluatedQuestions,
      plannedQuestionsCount: coverageSummary.plannedQuestions,
    },
    assessedCompetencies: competencyEvaluations
      .filter((c) => c.assessmentStatus !== 'NOT_ASSESSED')
      .map((c) => ({
        competencyName: c.competencyName,
        assessmentStatus: c.assessmentStatus,
        ...(exposeScores && c.score !== null
          ? { score: c.score, scoreScale: c.scoreScale }
          : {}),
        strengths: c.strengths,
        developmentSuggestions: c.developmentAreas,
      })),
    demonstratedStrengths: strengths,
    developmentSuggestions: developmentAreas,
  };

  return {
    recruiterReport,
    candidateReport,
    visibilitySettings: {
      exposeCandidateScores: exposeScores,
    },
  };
};

module.exports = {
  generateReports,
};
