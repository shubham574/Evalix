const PROFILE_BUILDER_VERSION = '1.0';

/**
 * Build a canonical candidateProfileSnapshot from CandidateFacts while keeping
 * RESUME_EXTRACTED and CANDIDATE_ENTERED provenance distinct.
 */
const buildCandidateProfileSnapshot = ({ facts = [], evidenceRegistry = new Map() }) => {
  const byType = (type) => facts.filter((f) => f.factType === type);

  const resumeTitle = byType('PROFESSIONAL_TITLE').find((f) => f.sourceType === 'RESUME_EXTRACTED');
  const candidateTitle = byType('PROFESSIONAL_TITLE').find((f) => f.sourceType === 'CANDIDATE_ENTERED');
  const reportedExp = byType('REPORTED_EXPERIENCE_MONTHS').find((f) => f.sourceType === 'CANDIDATE_ENTERED');

  // Deduplicate skill display list by canonicalName while preserving all source facts
  const skillMap = new Map();
  for (const f of byType('SKILL')) {
    const key = (f.metadata?.canonicalName || f.value).toLowerCase();
    if (!skillMap.has(key)) {
      skillMap.set(key, {
        canonicalName: f.metadata?.canonicalName || f.value,
        category: f.metadata?.category || 'OTHER',
        factIds: [],
        sources: new Set(),
        evidenceIds: new Set(),
        verificationStatuses: new Set(),
      });
    }
    const entry = skillMap.get(key);
    entry.factIds.push(f.factId);
    entry.sources.add(f.sourceType);
    entry.verificationStatuses.add(f.verificationStatus);
    for (const id of f.evidenceIds || []) entry.evidenceIds.add(id);
  }

  const consolidatedSkills = Array.from(skillMap.values()).map((s) => ({
    canonicalName: s.canonicalName,
    category: s.category,
    factIds: s.factIds,
    sources: Array.from(s.sources),
    evidenceIds: Array.from(s.evidenceIds),
    verificationStatus: s.verificationStatuses.has('EVIDENCED')
      ? 'EVIDENCED'
      : s.verificationStatuses.has('SELF_REPORTED')
      ? 'SELF_REPORTED'
      : 'UNVERIFIED',
  }));

  return {
    schemaVersion: PROFILE_BUILDER_VERSION,
    professionalIdentity: {
      title: resumeTitle?.value || candidateTitle?.value || null,
      resumeTitleFactId: resumeTitle?.factId || null,
      candidateTitleFactId: candidateTitle?.factId || null,
      reportedExperienceMonths: reportedExp?.metadata?.months ?? null,
    },
    facts,
    consolidatedSkills,
    employments: byType('EMPLOYMENT'),
    projects: byType('PROJECT'),
    education: byType('EDUCATION'),
    certifications: byType('CERTIFICATION'),
    domainExperience: byType('DOMAIN_EXPERIENCE'),
    evidenceLookup: Object.fromEntries(evidenceRegistry.entries()),
  };
};

module.exports = {
  PROFILE_BUILDER_VERSION,
  buildCandidateProfileSnapshot,
};
