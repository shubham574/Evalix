const crypto = require('crypto');
const { registerFactEvidence } = require('../evidence/evidence-mapper');
const { resolveSkillAlias } = require('../matching/skill-alias.registry');

const NORMALIZATION_VERSION = '1.0';

const makeRequirementId = (category, rawKey) => {
  const hash = crypto
    .createHash('sha1')
    .update(`${category}|${String(rawKey || '').toLowerCase()}`)
    .digest('hex')
    .slice(0, 10);
  return `REQ_${category.slice(0, 4)}_${hash}`;
};

/**
 * Normalize Module 2 JOB_DESCRIPTION extraction + TargetJobProfile into
 * canonical JobRequirements without inventing priority, importance, or experience.
 */
const normalizeJobRequirements = ({ jdExtraction = null, targetJobProfile = null }) => {
  const requirements = [];
  const evidenceRegistry = new Map();
  const jdDocId = jdExtraction?.documentId ? String(jdExtraction.documentId) : null;
  const jdData = jdExtraction?.extractedData || {};

  // 1. Technical skills (preserve MUST_HAVE vs PREFERRED vs OPTIONAL and importance)
  for (const skill of jdData.skills || []) {
    const aliasInfo = resolveSkillAlias(skill.name);
    const evIds = registerFactEvidence(evidenceRegistry, skill.evidence, jdDocId);
    requirements.push({
      requirementId: makeRequirementId('TECH', `${skill.name}:${skill.requirementType}`),
      originalWording: skill.name,
      normalizedName: aliasInfo.canonicalName || skill.name,
      category: aliasInfo.category === 'FUNCTIONAL' ? 'FUNCTIONAL' : 'TECHNICAL',
      requirementType: skill.requirementType || 'MUST_HAVE',
      importance: skill.importance || 'MEDIUM',
      sourceEvidenceIds: evIds,
      normalizationVersion: NORMALIZATION_VERSION,
    });
  }

  // 2. Job responsibilities
  for (const resp of jdData.responsibilities || []) {
    const evIds = registerFactEvidence(evidenceRegistry, resp.evidence, jdDocId);
    const reqType =
      resp.priority === 'OPTIONAL'
        ? 'OPTIONAL'
        : resp.priority === 'SECONDARY'
        ? 'PREFERRED'
        : 'MUST_HAVE';
    requirements.push({
      requirementId: makeRequirementId('RESP', resp.text),
      originalWording: resp.text,
      normalizedName: resp.text,
      category: 'RESPONSIBILITY',
      requirementType: reqType,
      importance: resp.priority === 'CORE' ? 'HIGH' : resp.priority === 'SECONDARY' ? 'MEDIUM' : 'LOW',
      sourceEvidenceIds: evIds,
      normalizationVersion: NORMALIZATION_VERSION,
    });
  }

  // 3. Functional, Behavioural, Education, Domain
  const listGroups = [
    { items: jdData.functionalCompetencies || [], category: 'FUNCTIONAL', reqType: 'MUST_HAVE' },
    { items: jdData.behaviouralCompetencies || [], category: 'BEHAVIOURAL', reqType: 'MUST_HAVE' },
    { items: jdData.requiredQualifications || [], category: 'EDUCATION', reqType: 'MUST_HAVE' },
    { items: jdData.preferredQualifications || [], category: 'EDUCATION', reqType: 'PREFERRED' },
    { items: jdData.domainKnowledge || [], category: 'DOMAIN', reqType: 'PREFERRED' },
  ];

  for (const group of listGroups) {
    for (const text of group.items) {
      if (!text || !String(text).trim()) continue;
      requirements.push({
        requirementId: makeRequirementId(group.category, text),
        originalWording: text,
        normalizedName: String(text).trim(),
        category: group.category,
        requirementType: group.reqType,
        importance: null,
        sourceEvidenceIds: [],
        normalizationVersion: NORMALIZATION_VERSION,
      });
    }
  }

  // 4. Experience requirement (only if explicitly present in JD)
  const minMonths = jdData.jobInformation?.minimumExperienceMonths?.value ?? null;
  if (typeof minMonths === 'number' && minMonths > 0) {
    const evIds = registerFactEvidence(
      evidenceRegistry,
      jdData.jobInformation?.minimumExperienceMonths?.evidence || [],
      jdDocId
    );
    requirements.push({
      requirementId: makeRequirementId('EXP', `min_months_${minMonths}`),
      originalWording: `Minimum ${minMonths} months of experience`,
      normalizedName: `Minimum ${minMonths} months experience`,
      category: 'EXPERIENCE',
      requirementType: 'MUST_HAVE',
      importance: 'HIGH',
      minimumMonths: minMonths,
      sourceEvidenceIds: evIds,
      normalizationVersion: NORMALIZATION_VERSION,
    });
  }

  return {
    normalizationVersion: NORMALIZATION_VERSION,
    jobTitle: jdData.jobInformation?.jobTitle?.value || targetJobProfile?.targetRole || null,
    companyName: jdData.jobInformation?.companyName?.value || targetJobProfile?.targetCompany || null,
    seniorityLevel: jdData.jobInformation?.seniorityLevel?.value || null,
    minimumExperienceMonths: minMonths,
    maximumExperienceMonths: jdData.jobInformation?.maximumExperienceMonths?.value ?? null,
    ambiguities: jdData.ambiguities || [],
    missingInformation: jdData.missingInformation || [],
    requirements,
    evidenceLookup: Object.fromEntries(evidenceRegistry.entries()),
  };
};

module.exports = {
  NORMALIZATION_VERSION,
  normalizeJobRequirements,
  makeRequirementId,
};
