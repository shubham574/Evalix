/**
 * Strict separation between Candidate-Facing DTOs and Private Interviewer/Orchestrator DTOs.
 * Candidate responses NEVER expose evaluationRubrics, criticalMisconceptions, expectedEvidence,
 * followUpPolicy trigger rules, candidateFactReferences, or internal modelMetadata.
 */

const toCandidateFacingBlueprint = (bp) => ({
  blueprintId: String(bp._id),
  blueprintVersion: bp.blueprintVersion,
  intakeId: String(bp.intakeId),
  status: bp.status,
  interviewType: bp.interviewType,
  targetRole: bp.targetRole,
  seniorityLevel: bp.seniorityLevel,
  totalDurationSeconds: bp.totalDurationSeconds,
  stages: (bp.stages || []).map((s) => ({
    stageId: s.stageId,
    stageName: s.stageName,
    stageType: s.stageType,
    objective: s.objective,
    durationSeconds: s.durationSeconds,
    order: s.order,
  })),
  topics: (bp.competencyPlan || []).map((c) => ({
    name: c.name,
    category: c.category,
  })),
  createdAt: bp.createdAt,
});

const toCandidateFacingQuestions = (bp) =>
  (bp.questionPlan || [])
    .filter((q) => q.candidateVisible !== false)
    .map((q) => ({
      questionId: q.questionId,
      stageId: q.stageId,
      questionType: q.questionType,
      questionCategory: q.questionCategory,
      questionText: q.questionText,
      difficulty: q.difficulty,
      expectedResponseSeconds: q.expectedResponseSeconds,
      thinkingAllowanceSeconds: q.thinkingAllowanceSeconds,
    }));

const toInternalOrchestratorBlueprint = (bp) => ({
  blueprintId: String(bp._id),
  blueprintVersion: bp.blueprintVersion,
  intakeId: String(bp.intakeId),
  candidateProfileId: String(bp.candidateProfileId),
  candidateAnalysisId: String(bp.candidateAnalysisId),
  status: bp.status,
  isLockedForSession: Boolean(bp.isLockedForSession),
  interviewType: bp.interviewType,
  targetRole: bp.targetRole,
  roleFamily: bp.roleFamily,
  seniorityLevel: bp.seniorityLevel,
  totalDurationSeconds: bp.totalDurationSeconds,
  competencies: bp.competencyPlan || [],
  excludedRequirements: bp.excludedRequirements || [],
  stages: bp.stages || [],
  coreQuestions: (bp.questionPlan || []).filter((q) => q.consistencyClass === 'CORE_ASSESSMENT'),
  personalisedQuestions: (bp.questionPlan || []).filter((q) => q.consistencyClass === 'PERSONALISED_ASSESSMENT'),
  questionPlan: bp.questionPlan || [],
  followUpPolicies: Object.fromEntries(
    (bp.questionPlan || []).map((q) => [q.questionId, q.followUpPolicy])
  ),
  evaluationRubrics: bp.evaluationRubrics || [],
  rubricReferences: bp.rubricReferences || {},
  stageCompletionConditions: Object.fromEntries(
    (bp.stages || []).map((s) => [
      s.stageId,
      {
        completionCriteria: s.completionCriteria,
        minimumEvidenceRequirements: s.minimumEvidenceRequirements,
        durationSeconds: s.durationSeconds,
      },
    ])
  ),
  sourceVersions: bp.sourceVersions || {},
  planningConfigurationVersion: bp.planningConfigurationVersion,
  promptVersions: bp.promptVersions || {},
  modelMetadata: bp.modelMetadata || {},
  generationWarnings: bp.generationWarnings || [],
  createdAt: bp.createdAt,
});

module.exports = {
  toCandidateFacingBlueprint,
  toCandidateFacingQuestions,
  toInternalOrchestratorBlueprint,
};
