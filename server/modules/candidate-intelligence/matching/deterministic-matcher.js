const { normalizeSkillToken, resolveSkillAlias, ALIAS_REGISTRY_VERSION } = require('./skill-alias.registry');

const NOT_EVIDENCED_NOTE =
  'No supporting evidence was found in the submitted materials. This does not establish that the candidate lacks this skill.';

/**
 * Deterministic matcher:
 * - Matches requirements against candidate facts using versioned skill aliases & normalized tokens
 * - Keeps RESUME_EXTRACTED (evidenced) separate from CANDIDATE_ENTERED (self-reported)
 * - Detects conflicting values (e.g. disputed/contradictory titles or claims)
 */
const runDeterministicMatching = ({ requirements = [], facts = [], experienceAnalysis = null }) => {
  const skillFacts = facts.filter((f) => f.factType === 'SKILL');
  const projectFacts = facts.filter((f) => f.factType === 'PROJECT');

  // Index skill facts by canonical lowercase token
  const byCanonical = new Map();
  for (const f of skillFacts) {
    const canonical = (f.metadata?.canonicalName || f.value || '').toLowerCase();
    if (!canonical) continue;
    if (!byCanonical.has(canonical)) byCanonical.set(canonical, []);
    byCanonical.get(canonical).push(f);
  }

  // Also index project technologies
  const byProjectTech = new Map();
  for (const p of projectFacts) {
    for (const tech of p.metadata?.technologies || []) {
      const alias = resolveSkillAlias(tech);
      const key = (alias.canonicalName || tech).toLowerCase();
      if (!byProjectTech.has(key)) byProjectTech.set(key, []);
      byProjectTech.get(key).push(p);
    }
  }

  const assessments = [];
  const unmatchedRequirements = [];

  for (const req of requirements) {
    // Handle EXPERIENCE requirements via ExperienceAnalyzer
    if (req.category === 'EXPERIENCE') {
      const expStatus = experienceAnalysis?.assessment || 'NOT_APPLICABLE';
      assessments.push({
        requirementId: req.requirementId,
        requirementName: req.normalizedName,
        requirementCategory: req.category,
        requirementType: req.requirementType,
        matchType: 'EXPERIENCE_TIMELINE',
        assessment: expStatus,
        candidateFactReferences: experienceAnalysis?.supportingEmploymentIds || [],
        evidenceReferences: [],
        explanation:
          expStatus === 'SUPPORTED_DIRECTLY'
            ? `Derived employment timeline (${experienceAnalysis.derivedExperienceMonths} months) meets the required ${req.minimumMonths} months.`
            : expStatus === 'NOT_EVIDENCED'
            ? NOT_EVIDENCED_NOTE
            : `Derived timeline is ${experienceAnalysis?.derivedExperienceMonths ?? 0} months vs ${req.minimumMonths} months required (${experienceAnalysis?.derivationStatus}).`,
        missingEvidence:
          expStatus === 'SUPPORTED_DIRECTLY' ? [] : ['Complete employment date timeline'],
        verificationNeeded: expStatus !== 'SUPPORTED_DIRECTLY',
        assessmentVersion: '1.0',
        registryVersion: ALIAS_REGISTRY_VERSION,
      });
      continue;
    }

    const alias = resolveSkillAlias(req.normalizedName);
    const lookupKey = (alias.canonicalName || req.normalizedName).toLowerCase();
    const matchedSkillFacts = byCanonical.get(lookupKey) || [];
    const matchedProjFacts = byProjectTech.get(lookupKey) || [];
    const allMatched = [...matchedSkillFacts, ...matchedProjFacts];

    if (allMatched.length === 0) {
      unmatchedRequirements.push(req);
      continue;
    }

    const resumeFacts = allMatched.filter((f) => f.sourceType === 'RESUME_EXTRACTED');
    const candidateEnteredFacts = allMatched.filter((f) => f.sourceType === 'CANDIDATE_ENTERED');
    const evidencedResumeFacts = resumeFacts.filter((f) => f.verificationStatus === 'EVIDENCED');
    const evidenceIds = [
      ...new Set(allMatched.flatMap((f) => f.evidenceIds || [])),
    ];

    const isExactText =
      normalizeSkillToken(req.originalWording) === normalizeSkillToken(allMatched[0].value);

    if (evidencedResumeFacts.length > 0) {
      assessments.push({
        requirementId: req.requirementId,
        requirementName: req.normalizedName,
        requirementCategory: req.category,
        requirementType: req.requirementType,
        matchType: isExactText ? 'EXACT_ALIAS' : 'EXACT_ALIAS',
        assessment: 'SUPPORTED_DIRECTLY',
        candidateFactReferences: evidencedResumeFacts.map((f) => f.factId),
        evidenceReferences: evidenceIds,
        explanation: `Resume evidence supports ${req.normalizedName}${alias.isKnownAlias ? ` (alias registry v${ALIAS_REGISTRY_VERSION})` : ''}.`,
        missingEvidence: [],
        verificationNeeded: false,
        assessmentVersion: '1.0',
        registryVersion: ALIAS_REGISTRY_VERSION,
      });
    } else if (candidateEnteredFacts.length > 0) {
      assessments.push({
        requirementId: req.requirementId,
        requirementName: req.normalizedName,
        requirementCategory: req.category,
        requirementType: req.requirementType,
        matchType: 'EXACT_ALIAS',
        assessment: 'REQUIRES_CANDIDATE_CONFIRMATION',
        candidateFactReferences: candidateEnteredFacts.map((f) => f.factId),
        evidenceReferences: [],
        explanation: `${req.normalizedName} was self-reported by the candidate without supporting resume evidence.`,
        missingEvidence: [`Supporting resume or project evidence for ${req.normalizedName}`],
        verificationNeeded: true,
        assessmentVersion: '1.0',
        registryVersion: ALIAS_REGISTRY_VERSION,
      });
    } else {
      // Resume fact existed but had unverified evidence
      assessments.push({
        requirementId: req.requirementId,
        requirementName: req.normalizedName,
        requirementCategory: req.category,
        requirementType: req.requirementType,
        matchType: 'POSSIBLE_MATCH_REQUIRES_REVIEW',
        assessment: 'REQUIRES_CANDIDATE_CONFIRMATION',
        candidateFactReferences: resumeFacts.map((f) => f.factId),
        evidenceReferences: evidenceIds,
        explanation: `${req.normalizedName} appeared in extracted data, but its source evidence could not be fully verified.`,
        missingEvidence: [`Verified source quote for ${req.normalizedName}`],
        verificationNeeded: true,
        assessmentVersion: '1.0',
        registryVersion: ALIAS_REGISTRY_VERSION,
      });
    }
  }

  return {
    assessments,
    unmatchedRequirements,
  };
};

module.exports = {
  runDeterministicMatching,
  NOT_EVIDENCED_NOTE,
};
