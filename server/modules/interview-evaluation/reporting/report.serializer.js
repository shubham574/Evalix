const toCandidateReportDto = (reportDoc, run) => ({
  evaluationRunId: String(reportDoc.evaluationRunId),
  reportVersion: reportDoc.reportVersion,
  evaluationVersion: run?.evaluationVersion || 1,
  generationStatus: reportDoc.generationStatus,
  report: reportDoc.candidateReport,
  createdAt: reportDoc.createdAt,
});

const toRecruiterReportDto = (reportDoc, run) => ({
  evaluationRunId: String(reportDoc.evaluationRunId),
  reportVersion: reportDoc.reportVersion,
  evaluationVersion: run?.evaluationVersion || 1,
  blueprintVersion: run?.blueprintVersion || null,
  reviewStatus: run?.reviewStatus || 'PENDING_REVIEW',
  generationStatus: reportDoc.generationStatus,
  report: reportDoc.recruiterReport,
  createdAt: reportDoc.createdAt,
});

const toCandidateQuestionDto = (q) => ({
  questionId: q.questionId,
  competencyId: q.competencyId,
  questionText: q.questionText,
  evaluationStatus: q.evaluationStatus,
  strengths: q.strengths,
  developmentAreas: q.developmentAreas,
});

const toRecruiterQuestionDto = (q) => ({
  id: String(q._id),
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
  strengths: q.strengths,
  developmentAreas: q.developmentAreas,
  missingEvidence: q.missingEvidence,
  explanation: q.explanation,
  reviewRequired: q.reviewRequired,
  reviewFlags: q.reviewFlags,
  humanOverride: q.humanOverride || null,
});

module.exports = {
  toCandidateReportDto,
  toRecruiterReportDto,
  toCandidateQuestionDto,
  toRecruiterQuestionDto,
};
