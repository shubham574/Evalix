const { PlannedQuestionSchema } = require('../question-engine/question.schema');
const { EvaluationRubricSchema } = require('../assessment/rubric.schema');

const validateBlueprint = ({
  totalDurationSeconds,
  stages = [],
  competencyPlan = [],
  excludedRequirements = [],
  questions = [],
  evaluationRubrics = [],
  reviewedFacts = [],
  jobRequirements = [],
}) => {
  const errors = [];
  const warnings = [];

  // 1. Time validation: SUM(stage.durationSeconds) === totalDurationSeconds
  const stageSum = stages.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  if (stageSum !== totalDurationSeconds) {
    errors.push(
      `Time validation failed: sum of stage durations (${stageSum}s) !== totalDurationSeconds (${totalDurationSeconds}s)`
    );
  }

  const stageById = new Map(stages.map((s) => [s.stageId, s]));
  const factIds = new Set(reviewedFacts.map((f) => f.factId));
  const reqIds = new Set(jobRequirements.map((r) => r.requirementId));
  const compIds = new Set(competencyPlan.map((c) => c.competencyId));
  const rubricById = new Map(evaluationRubrics.map((r) => [r.rubricId, r]));

  // 2. Question & source-reference validation
  const seenQuestionText = new Set();
  const stageQuestionTime = new Map();

  for (const q of questions) {
    const parsedQ = PlannedQuestionSchema.safeParse(q);
    if (!parsedQ.success) {
      errors.push(`Question ${q.questionId || '?'} failed schema validation: ${parsedQ.error.issues[0]?.message}`);
      continue;
    }

    const normText = q.questionText.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenQuestionText.has(normText)) {
      errors.push(`Duplicate question detected: ${q.questionId}`);
    }
    seenQuestionText.add(normText);

    if (!stageById.has(q.stageId)) {
      errors.push(`Question ${q.questionId} references unknown stage ${q.stageId}`);
    }

    for (const cId of q.competencyIds) {
      if (!compIds.has(cId)) {
        errors.push(`Question ${q.questionId} references unknown competency ${cId}`);
      }
    }

    for (const rId of q.requirementIds || []) {
      if (!reqIds.has(rId)) {
        errors.push(`Question ${q.questionId} references unknown requirementId ${rId}`);
      }
    }

    for (const fId of q.candidateFactReferences || []) {
      if (!factIds.has(fId)) {
        errors.push(`Question ${q.questionId} references unknown candidateFactId ${fId}`);
      }
    }

    if (q.consistencyClass === 'PERSONALISED_ASSESSMENT' && (q.candidateFactReferences || []).length === 0) {
      errors.push(`Personalised question ${q.questionId} must reference at least one candidate fact`);
    }

    // Check rubric reference
    const rubric = rubricById.get(q.evaluationRubricId);
    if (!rubric) {
      errors.push(`Question ${q.questionId} missing rubric ${q.evaluationRubricId}`);
    } else {
      const parsedR = EvaluationRubricSchema.safeParse(rubric);
      if (!parsedR.success) {
        errors.push(`Rubric ${rubric.rubricId} invalid: ${parsedR.error.issues[0]?.message}`);
      }
    }

    const qTime = (q.expectedResponseSeconds || 0) + (q.followUpPolicy?.followUpBudgetSeconds || 0);
    stageQuestionTime.set(q.stageId, (stageQuestionTime.get(q.stageId) || 0) + qTime);
  }

  for (const [stageId, usedSeconds] of stageQuestionTime.entries()) {
    const stage = stageById.get(stageId);
    if (stage && usedSeconds > stage.durationSeconds + 30) {
      errors.push(`Stage ${stageId} question budget (${usedSeconds}s) exceeds stage duration (${stage.durationSeconds}s)`);
    }
  }

  // 3. Coverage validation: every MUST_HAVE requirement is covered or explicitly excluded
  const coveredReqIds = new Set([
    ...competencyPlan.flatMap((c) => c.sourceRequirementIds || []),
    ...excludedRequirements.flatMap((e) => e.sourceRequirementIds || []),
  ]);
  for (const req of jobRequirements) {
    if (req.requirementType === 'MUST_HAVE' && !coveredReqIds.has(req.requirementId)) {
      warnings.push(`MUST_HAVE requirement ${req.normalizedName} (${req.requirementId}) not covered in plan`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

module.exports = {
  validateBlueprint,
};
