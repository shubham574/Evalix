const crypto = require('crypto');

const COMPETENCY_PLANNER_VERSION = '1.0.0';

const makeCompetencyId = (name) => {
  const slug = String(name || 'COMP')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18);
  const hash = crypto.createHash('sha1').update(String(name || '')).digest('hex').slice(0, 6);
  return `COMP_${slug || 'GEN'}_${hash}`;
};

const MAX_COMPETENCIES_BY_MINUTES = (minutes) => {
  if (minutes <= 15) return 3;
  if (minutes <= 30) return 5;
  if (minutes <= 45) return 7;
  if (minutes <= 60) return 9;
  return 12;
};

/**
 * Build a deterministic competency coverage plan from Module 3 assessments & JD requirements.
 * - Distinguishes MUST_HAVE vs PREFERRED vs OPTIONAL
 * - Deduplicates overlapping requirements by normalizedName
 * - Tracks any requirements excluded due to duration budget
 */
const buildCompetencyPlan = ({
  requirements = [],
  assessments = [],
  durationMinutes = 45,
  interviewType = 'MIXED',
  seniorityLevel = 'MID',
}) => {
  const assessmentByReqId = new Map(assessments.map((a) => [a.requirementId, a]));

  // Deduplicate overlapping requirements by lowercase normalized name
  const grouped = new Map();
  for (const req of requirements) {
    if (interviewType === 'BEHAVIOURAL' && req.category === 'TECHNICAL') continue;
    if (interviewType === 'TECHNICAL' && req.category === 'BEHAVIOURAL') continue;

    const key = String(req.normalizedName || req.originalWording || '').toLowerCase().trim();
    if (!key) continue;

    const ass = assessmentByReqId.get(req.requirementId);
    if (!grouped.has(key)) {
      grouped.set(key, {
        name: req.normalizedName || req.originalWording,
        category: req.category,
        requirementType: req.requirementType || 'MUST_HAVE',
        sourceRequirementIds: [],
        assessmentStatuses: [],
        verificationNeeded: false,
      });
    }
    const g = grouped.get(key);
    g.sourceRequirementIds.push(req.requirementId);
    if (req.requirementType === 'MUST_HAVE') g.requirementType = 'MUST_HAVE';
    if (ass) {
      g.assessmentStatuses.push(ass.assessment);
      if (ass.verificationNeeded) g.verificationNeeded = true;
    }
  }

  // Score priority deterministically: MUST_HAVE > PREFERRED > OPTIONAL; evidence gaps get deeper probing
  const rankOrder = { MUST_HAVE: 3, PREFERRED: 2, OPTIONAL: 1 };
  const candidates = Array.from(grouped.values()).sort((a, b) => {
    const rDiff = (rankOrder[b.requirementType] || 0) - (rankOrder[a.requirementType] || 0);
    if (rDiff !== 0) return rDiff;
    const aGap = a.assessmentStatuses.includes('NOT_EVIDENCED') || a.verificationNeeded ? 1 : 0;
    const bGap = b.assessmentStatuses.includes('NOT_EVIDENCED') || b.verificationNeeded ? 1 : 0;
    return bGap - aGap;
  });

  const maxCount = MAX_COMPETENCIES_BY_MINUTES(durationMinutes);
  const included = candidates.slice(0, maxCount);
  const excluded = candidates.slice(maxCount);

  const isSenior = ['SENIOR', 'LEAD', 'PRINCIPAL'].some((s) =>
    String(seniorityLevel || '').toUpperCase().includes(s)
  );

  const competencies = included.map((c) => {
    const priority =
      c.requirementType === 'MUST_HAVE'
        ? 'HIGH'
        : c.requirementType === 'PREFERRED'
        ? 'MEDIUM'
        : 'LOW';

    const hasGap =
      c.assessmentStatuses.includes('NOT_EVIDENCED') ||
      c.assessmentStatuses.includes('REQUIRES_CANDIDATE_CONFIRMATION') ||
      c.verificationNeeded;

    const assessmentDepth =
      priority === 'HIGH' && (isSenior || hasGap)
        ? 'DEEP'
        : priority === 'HIGH' || hasGap
        ? 'STANDARD'
        : 'LIGHT';

    const assessmentMethods =
      c.category === 'BEHAVIOURAL'
        ? ['BEHAVIOURAL']
        : c.category === 'TECHNICAL'
        ? assessmentDepth === 'DEEP'
          ? ['CONCEPTUAL', 'PRACTICAL']
          : ['CONCEPTUAL', 'SCENARIO']
        : ['SCENARIO'];

    return {
      competencyId: makeCompetencyId(c.name),
      name: c.name,
      category: c.category,
      requirementType: c.requirementType,
      priority,
      assessmentDepth,
      sourceRequirementIds: c.sourceRequirementIds,
      assessmentMethods,
      hasEvidenceGap: hasGap,
    };
  });

  const excludedRequirements = excluded.map((c) => ({
    name: c.name,
    requirementType: c.requirementType,
    sourceRequirementIds: c.sourceRequirementIds,
    reason: `Excluded due to ${durationMinutes}-minute interview duration cap (${maxCount} competencies max).`,
  }));

  return {
    competencies,
    excludedRequirements,
    plannerVersion: COMPETENCY_PLANNER_VERSION,
  };
};

module.exports = {
  COMPETENCY_PLANNER_VERSION,
  buildCompetencyPlan,
  makeCompetencyId,
};
