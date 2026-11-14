const TEMPLATE_REGISTRY_VERSION = '1.0.0';

const ROLE_FAMILIES = [
  'SOFTWARE_ENGINEERING',
  'ANALYTICS',
  'BUSINESS',
  'DESIGN',
  'MANAGEMENT',
  'HR_RECRUITMENT',
  'GENERAL',
];

const ROLE_FAMILY_RULES = [
  {
    family: 'SOFTWARE_ENGINEERING',
    keywords: ['software', 'developer', 'engineer', 'backend', 'frontend', 'full-stack', 'fullstack', 'devops', 'sre', 'qa', 'mobile', 'architect'],
    practicalMode: 'CODING_OR_SYSTEM_DESIGN',
    stageWeights: {
      INTRODUCTION: 0.08,
      PROJECT_DEEP_DIVE: 0.22,
      TECHNICAL_ASSESSMENT: 0.26,
      PRACTICAL_ASSESSMENT: 0.20,
      BEHAVIOURAL_ASSESSMENT: 0.14,
      CANDIDATE_QUESTIONS: 0.06,
      CLOSING: 0.04,
    },
  },
  {
    family: 'ANALYTICS',
    keywords: ['analyst', 'data scientist', 'bi ', 'business intelligence', 'analytics', 'machine learning'],
    practicalMode: 'SQL_AND_CASE_STUDY',
    stageWeights: {
      INTRODUCTION: 0.08,
      PROJECT_DEEP_DIVE: 0.20,
      ROLE_SPECIFIC_ASSESSMENT: 0.26,
      PRACTICAL_ASSESSMENT: 0.22,
      BEHAVIOURAL_ASSESSMENT: 0.14,
      CANDIDATE_QUESTIONS: 0.06,
      CLOSING: 0.04,
    },
  },
  {
    family: 'BUSINESS',
    keywords: ['sales', 'business development', 'marketing', 'customer success', 'account executive', 'growth', 'operations'],
    practicalMode: 'ROLE_PLAY_AND_SCENARIO',
    stageWeights: {
      INTRODUCTION: 0.08,
      BACKGROUND: 0.18,
      ROLE_SPECIFIC_ASSESSMENT: 0.26,
      SCENARIO_ASSESSMENT: 0.22,
      BEHAVIOURAL_ASSESSMENT: 0.16,
      CANDIDATE_QUESTIONS: 0.06,
      CLOSING: 0.04,
    },
  },
  {
    family: 'DESIGN',
    keywords: ['ui/ux', 'ux', 'ui ', 'product design', 'graphic design', 'designer'],
    practicalMode: 'PORTFOLIO_AND_USABILITY_CRITIQUE',
    stageWeights: {
      INTRODUCTION: 0.08,
      PROJECT_DEEP_DIVE: 0.26,
      ROLE_SPECIFIC_ASSESSMENT: 0.22,
      PRACTICAL_ASSESSMENT: 0.20,
      BEHAVIOURAL_ASSESSMENT: 0.14,
      CANDIDATE_QUESTIONS: 0.06,
      CLOSING: 0.04,
    },
  },
  {
    family: 'MANAGEMENT',
    keywords: ['product manager', 'project manager', 'engineering manager', 'team lead', 'program manager', 'scrum'],
    practicalMode: 'STRATEGY_AND_LEADERSHIP_CASE',
    stageWeights: {
      INTRODUCTION: 0.08,
      BACKGROUND: 0.18,
      ROLE_SPECIFIC_ASSESSMENT: 0.24,
      SCENARIO_ASSESSMENT: 0.22,
      BEHAVIOURAL_ASSESSMENT: 0.18,
      CANDIDATE_QUESTIONS: 0.06,
      CLOSING: 0.04,
    },
  },
  {
    family: 'HR_RECRUITMENT',
    keywords: ['recruiter', 'talent acquisition', 'hr ', 'human resources', 'people ops'],
    practicalMode: 'SOURCING_AND_STAKEHOLDER_SCENARIO',
    stageWeights: {
      INTRODUCTION: 0.08,
      BACKGROUND: 0.18,
      ROLE_SPECIFIC_ASSESSMENT: 0.24,
      SCENARIO_ASSESSMENT: 0.22,
      BEHAVIOURAL_ASSESSMENT: 0.18,
      CANDIDATE_QUESTIONS: 0.06,
      CLOSING: 0.04,
    },
  },
];

const classifyRoleFamily = (targetRole = '') => {
  const lower = String(targetRole || '').toLowerCase();
  for (const rule of ROLE_FAMILY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule;
    }
  }
  return {
    family: 'GENERAL',
    practicalMode: 'ROLE_SCENARIO',
    stageWeights: {
      INTRODUCTION: 0.08,
      BACKGROUND: 0.20,
      ROLE_SPECIFIC_ASSESSMENT: 0.26,
      SCENARIO_ASSESSMENT: 0.20,
      BEHAVIOURAL_ASSESSMENT: 0.16,
      CANDIDATE_QUESTIONS: 0.06,
      CLOSING: 0.04,
    },
  };
};

const SENIORITY_DIFFICULTY_MAP = {
  INTERN: 'FOUNDATIONAL',
  FRESHER: 'FOUNDATIONAL',
  JUNIOR: 'BASIC',
  MID: 'INTERMEDIATE',
  SENIOR: 'ADVANCED',
  LEAD: 'EXPERT',
  PRINCIPAL: 'EXPERT',
};

const resolveTargetDifficulty = (seniorityLevel = 'MID') => {
  const upper = String(seniorityLevel || 'MID').toUpperCase();
  for (const [key, diff] of Object.entries(SENIORITY_DIFFICULTY_MAP)) {
    if (upper.includes(key)) return diff;
  }
  return 'INTERMEDIATE';
};

module.exports = {
  TEMPLATE_REGISTRY_VERSION,
  ROLE_FAMILIES,
  classifyRoleFamily,
  resolveTargetDifficulty,
};
