const { classifyRoleFamily } = require('../templates/interview-template.registry');

const STAGE_LABELS = {
  INTRODUCTION: { name: 'Introduction & Expectations', objective: 'Establish rapport and align on interview structure.' },
  BACKGROUND: { name: 'Background & Role Experience', objective: 'Validate career context and domain experience.' },
  PROJECT_DEEP_DIVE: { name: 'Project Deep Dive', objective: 'Verify ownership, implementation choices, and impact from candidate projects.' },
  TECHNICAL_ASSESSMENT: { name: 'Core Technical Assessment', objective: 'Evaluate core technical competencies required for the role.' },
  ROLE_SPECIFIC_ASSESSMENT: { name: 'Role-Specific Competency Assessment', objective: 'Evaluate domain and functional competencies required for the role.' },
  PRACTICAL_ASSESSMENT: { name: 'Practical Problem-Solving', objective: 'Assess hands-on execution, debugging, or case reasoning.' },
  SCENARIO_ASSESSMENT: { name: 'Scenario & Role-Play Assessment', objective: 'Evaluate applied judgment in realistic role scenarios.' },
  BEHAVIOURAL_ASSESSMENT: { name: 'Behavioural & Collaboration', objective: 'Assess collaboration, ownership, and problem-solving under pressure.' },
  CANDIDATE_QUESTIONS: { name: 'Candidate Questions', objective: 'Reserve time for candidate questions about the role and team.' },
  CLOSING: { name: 'Closing', objective: 'Wrap up the interview and outline next steps.' },
};

/**
 * Deterministically allocate stage durations so SUM(stage.durationSeconds) === totalDurationSeconds.
 */
const planStages = ({
  targetRole,
  interviewType = 'MIXED',
  durationMinutes = 45,
  competencies = [],
}) => {
  const totalDurationSeconds = Math.max(15, Number(durationMinutes) || 45) * 60;
  const roleRule = classifyRoleFamily(targetRole);
  let weights = { ...roleRule.stageWeights };

  if (interviewType === 'BEHAVIOURAL') {
    weights = {
      INTRODUCTION: 0.08,
      BACKGROUND: 0.22,
      BEHAVIOURAL_ASSESSMENT: 0.42,
      SCENARIO_ASSESSMENT: 0.18,
      CANDIDATE_QUESTIONS: 0.06,
      CLOSING: 0.04,
    };
  } else if (interviewType === 'TECHNICAL') {
    weights = {
      INTRODUCTION: 0.07,
      PROJECT_DEEP_DIVE: 0.25,
      TECHNICAL_ASSESSMENT: 0.34,
      PRACTICAL_ASSESSMENT: 0.24,
      CANDIDATE_QUESTIONS: 0.06,
      CLOSING: 0.04,
    };
  }

  // For 15-minute interviews, omit practical/scenario heavy stage to keep realistic question budgets
  if (durationMinutes <= 15) {
    delete weights.PRACTICAL_ASSESSMENT;
    delete weights.SCENARIO_ASSESSMENT;
  }

  const stageTypes = Object.keys(weights);
  const weightSum = stageTypes.reduce((sum, k) => sum + weights[k], 0);

  let allocated = 0;
  const stages = stageTypes.map((stageType, idx) => {
    const isLast = idx === stageTypes.length - 1;
    const durationSeconds = isLast
      ? totalDurationSeconds - allocated
      : Math.round((weights[stageType] / weightSum) * totalDurationSeconds);
    allocated += durationSeconds;

    const meta = STAGE_LABELS[stageType] || { name: stageType, objective: stageType };
    const reqComps = competencies
      .filter((c) => {
        if (stageType === 'BEHAVIOURAL_ASSESSMENT') return c.category === 'BEHAVIOURAL';
        if (['TECHNICAL_ASSESSMENT', 'ROLE_SPECIFIC_ASSESSMENT', 'PRACTICAL_ASSESSMENT', 'SCENARIO_ASSESSMENT'].includes(stageType)) {
          return c.category !== 'BEHAVIOURAL';
        }
        return false;
      })
      .map((c) => c.competencyId);

    return {
      stageId: `STAGE_${stageType}`,
      stageName: meta.name,
      stageType,
      objective: meta.objective,
      durationSeconds,
      requiredCompetencies: reqComps,
      plannedQuestionIds: [],
      completionCriteria:
        stageType === 'INTRODUCTION' || stageType === 'CLOSING' || stageType === 'CANDIDATE_QUESTIONS'
          ? 'Stage time or conversational transition completed.'
          : 'Planned core/personalised questions and permitted follow-ups completed within stage budget.',
      minimumEvidenceRequirements: reqComps.length > 0 ? 1 : 0,
      isMandatory: !['CANDIDATE_QUESTIONS', 'PRACTICAL_ASSESSMENT'].includes(stageType),
      order: idx + 1,
    };
  });

  return {
    roleFamily: roleRule.family,
    practicalMode: roleRule.practicalMode,
    totalDurationSeconds,
    stages,
  };
};

module.exports = {
  planStages,
};
