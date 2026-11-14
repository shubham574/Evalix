const crypto = require('crypto');
const { registerFactEvidence } = require('../evidence/evidence-mapper');
const { resolveSkillAlias } = require('../matching/skill-alias.registry');

const makeFactId = (sourceType, factType, key) => {
  const hash = crypto
    .createHash('sha1')
    .update(`${sourceType}|${factType}|${String(key || '')}`)
    .digest('hex')
    .slice(0, 12);
  return `FACT_${hash}`;
};

const determineVerificationStatus = (evidenceIds, evidenceRegistry, defaultStatus = 'EVIDENCED') => {
  if (!evidenceIds || evidenceIds.length === 0) {
    return 'UNVERIFIED';
  }
  const hasVerified = evidenceIds.some((id) => {
    const ev = evidenceRegistry.get(id);
    return ev && ev.matchConfidence !== 'UNVERIFIED';
  });
  return hasVerified ? defaultStatus : 'UNVERIFIED';
};

/**
 * Build canonical CandidateFacts from Module 1 candidate-entered records
 * and Module 2 RESUME extraction, strictly preserving provenance and PII minimization.
 */
const buildCandidateFacts = ({
  candidateProfile,
  candidateExperiences = [],
  candidateSkills = [],
  candidateProjects = [],
  resumeExtraction = null,
}) => {
  const facts = [];
  const evidenceRegistry = new Map();
  const nowIso = new Date().toISOString();

  const extractionVersion = resumeExtraction
    ? `${resumeExtraction.schemaVersion || '1.0'}:${resumeExtraction.extractorVersion || '1.0.0'}`
    : null;
  const resumeDocId = resumeExtraction?.documentId ? String(resumeExtraction.documentId) : null;
  const resumeData = resumeExtraction?.extractedData || null;

  // --- 1. Module 1: Candidate-entered facts (SELF_REPORTED, never treated as resume-evidenced) ---
  if (candidateProfile) {
    if (candidateProfile.currentJobTitle) {
      facts.push({
        factId: makeFactId('CANDIDATE_ENTERED', 'PROFESSIONAL_TITLE', candidateProfile.currentJobTitle),
        factType: 'PROFESSIONAL_TITLE',
        value: candidateProfile.currentJobTitle,
        metadata: {},
        sourceType: 'CANDIDATE_ENTERED',
        sourceDocumentId: null,
        evidenceIds: [],
        extractionVersion: null,
        verificationStatus: 'SELF_REPORTED',
        createdAt: candidateProfile.updatedAt ? new Date(candidateProfile.updatedAt).toISOString() : nowIso,
      });
    }
    if (candidateProfile.professionalSummary) {
      facts.push({
        factId: makeFactId('CANDIDATE_ENTERED', 'PROFESSIONAL_SUMMARY', candidateProfile.professionalSummary.slice(0, 80)),
        factType: 'PROFESSIONAL_SUMMARY',
        value: candidateProfile.professionalSummary,
        metadata: {},
        sourceType: 'CANDIDATE_ENTERED',
        sourceDocumentId: null,
        evidenceIds: [],
        extractionVersion: null,
        verificationStatus: 'SELF_REPORTED',
        createdAt: candidateProfile.updatedAt ? new Date(candidateProfile.updatedAt).toISOString() : nowIso,
      });
    }
    if (typeof candidateProfile.totalExperienceMonths === 'number') {
      facts.push({
        factId: makeFactId('CANDIDATE_ENTERED', 'REPORTED_EXPERIENCE_MONTHS', String(candidateProfile.totalExperienceMonths)),
        factType: 'REPORTED_EXPERIENCE_MONTHS',
        value: String(candidateProfile.totalExperienceMonths),
        metadata: { months: candidateProfile.totalExperienceMonths, experienceLevel: candidateProfile.experienceLevel },
        sourceType: 'CANDIDATE_ENTERED',
        sourceDocumentId: null,
        evidenceIds: [],
        extractionVersion: null,
        verificationStatus: 'SELF_REPORTED',
        createdAt: candidateProfile.updatedAt ? new Date(candidateProfile.updatedAt).toISOString() : nowIso,
      });
    }
  }

  for (const exp of candidateExperiences) {
    facts.push({
      factId: makeFactId('CANDIDATE_ENTERED', 'EMPLOYMENT', `${exp._id || exp.companyName}:${exp.jobTitle}`),
      factType: 'EMPLOYMENT',
      value: `${exp.jobTitle} at ${exp.companyName}`,
      metadata: {
        sourceRecordId: exp._id ? String(exp._id) : null,
        companyName: exp.companyName,
        jobTitle: exp.jobTitle,
        employmentType: exp.employmentType || 'FULL_TIME',
        startDate: exp.startDate ? new Date(exp.startDate).toISOString().slice(0, 10) : null,
        endDate: exp.endDate ? new Date(exp.endDate).toISOString().slice(0, 10) : null,
        isCurrent: Boolean(exp.isCurrent),
        description: exp.description || '',
      },
      sourceType: 'CANDIDATE_ENTERED',
      sourceDocumentId: null,
      evidenceIds: [],
      extractionVersion: null,
      verificationStatus: 'SELF_REPORTED',
      createdAt: exp.createdAt ? new Date(exp.createdAt).toISOString() : nowIso,
    });
  }

  for (const skill of candidateSkills) {
    const aliasInfo = resolveSkillAlias(skill.skillName);
    facts.push({
      factId: makeFactId('CANDIDATE_ENTERED', 'SKILL', `${skill._id || skill.normalizedSkillName}`),
      factType: 'SKILL',
      value: skill.skillName,
      metadata: {
        canonicalName: aliasInfo.canonicalName,
        normalizedToken: aliasInfo.normalizedToken,
        category: skill.skillCategory || aliasInfo.category,
        selfReportedProficiency: skill.selfReportedProficiency || 'INTERMEDIATE',
      },
      sourceType: 'CANDIDATE_ENTERED',
      sourceDocumentId: null,
      evidenceIds: [],
      extractionVersion: null,
      verificationStatus: 'SELF_REPORTED',
      createdAt: skill.createdAt ? new Date(skill.createdAt).toISOString() : nowIso,
    });
  }

  for (const proj of candidateProjects) {
    facts.push({
      factId: makeFactId('CANDIDATE_ENTERED', 'PROJECT', `${proj._id || proj.projectTitle}`),
      factType: 'PROJECT',
      value: proj.projectTitle,
      metadata: {
        description: proj.projectDescription || '',
        technologies: proj.technologies || [],
        responsibilities: proj.candidateResponsibility ? [proj.candidateResponsibility] : [],
      },
      sourceType: 'CANDIDATE_ENTERED',
      sourceDocumentId: null,
      evidenceIds: [],
      extractionVersion: null,
      verificationStatus: 'SELF_REPORTED',
      createdAt: proj.createdAt ? new Date(proj.createdAt).toISOString() : nowIso,
    });
  }

  // --- 2. Module 2: Resume-extracted facts (preserve evidence & extractionVersion) ---
  if (resumeData) {
    if (resumeData.professionalHeadline?.value) {
      const evIds = registerFactEvidence(evidenceRegistry, resumeData.professionalHeadline.evidence, resumeDocId);
      facts.push({
        factId: makeFactId('RESUME_EXTRACTED', 'PROFESSIONAL_TITLE', resumeData.professionalHeadline.value),
        factType: 'PROFESSIONAL_TITLE',
        value: resumeData.professionalHeadline.value,
        metadata: {},
        sourceType: 'RESUME_EXTRACTED',
        sourceDocumentId: resumeDocId,
        evidenceIds: evIds,
        extractionVersion,
        verificationStatus: determineVerificationStatus(evIds, evidenceRegistry),
        createdAt: resumeExtraction.completedAt ? new Date(resumeExtraction.completedAt).toISOString() : nowIso,
      });
    }

    if (resumeData.professionalSummary?.text) {
      const evIds = registerFactEvidence(evidenceRegistry, resumeData.professionalSummary.evidence, resumeDocId);
      facts.push({
        factId: makeFactId('RESUME_EXTRACTED', 'PROFESSIONAL_SUMMARY', resumeData.professionalSummary.text.slice(0, 80)),
        factType: 'PROFESSIONAL_SUMMARY',
        value: resumeData.professionalSummary.text,
        metadata: {},
        sourceType: 'RESUME_EXTRACTED',
        sourceDocumentId: resumeDocId,
        evidenceIds: evIds,
        extractionVersion,
        verificationStatus: determineVerificationStatus(evIds, evidenceRegistry),
        createdAt: resumeExtraction.completedAt ? new Date(resumeExtraction.completedAt).toISOString() : nowIso,
      });
    }

    for (let i = 0; i < (resumeData.workExperience || []).length; i++) {
      const exp = resumeData.workExperience[i];
      const company = exp.companyName?.value || 'Unknown Company';
      const title = exp.jobTitle?.value || 'Unknown Role';
      const rawEv = [
        ...(exp.companyName?.evidence || []),
        ...(exp.jobTitle?.evidence || []),
        ...(exp.startDate?.evidence || []),
        ...(exp.endDate?.evidence || []),
      ];
      const empEvIds = registerFactEvidence(evidenceRegistry, rawEv, resumeDocId);

      facts.push({
        factId: makeFactId('RESUME_EXTRACTED', 'EMPLOYMENT', `${i}:${company}:${title}`),
        factType: 'EMPLOYMENT',
        value: `${title} at ${company}`,
        metadata: {
          companyName: company,
          jobTitle: title,
          employmentType: exp.employmentType || null,
          startDate: exp.startDate || null,
          endDate: exp.endDate || null,
          isCurrent: Boolean(exp.isCurrent),
        },
        sourceType: 'RESUME_EXTRACTED',
        sourceDocumentId: resumeDocId,
        evidenceIds: empEvIds,
        extractionVersion,
        verificationStatus: determineVerificationStatus(empEvIds, evidenceRegistry),
        createdAt: nowIso,
      });

      for (let r = 0; r < (exp.responsibilities || []).length; r++) {
        const resp = exp.responsibilities[r];
        const rEvIds = registerFactEvidence(evidenceRegistry, resp.evidence, resumeDocId);
        facts.push({
          factId: makeFactId('RESUME_EXTRACTED', 'RESPONSIBILITY', `${i}:${r}:${resp.text.slice(0, 60)}`),
          factType: 'RESPONSIBILITY',
          value: resp.text,
          metadata: { companyName: company, jobTitle: title },
          sourceType: 'RESUME_EXTRACTED',
          sourceDocumentId: resumeDocId,
          evidenceIds: rEvIds,
          extractionVersion,
          verificationStatus: determineVerificationStatus(rEvIds, evidenceRegistry),
          createdAt: nowIso,
        });
      }

      for (let a = 0; a < (exp.achievements || []).length; a++) {
        const ach = exp.achievements[a];
        const aEvIds = registerFactEvidence(evidenceRegistry, ach.evidence, resumeDocId);
        facts.push({
          factId: makeFactId('RESUME_EXTRACTED', 'ACHIEVEMENT', `${i}:${a}:${ach.text.slice(0, 60)}`),
          factType: 'ACHIEVEMENT',
          value: ach.text,
          metadata: { metrics: ach.metrics || null, companyName: company },
          sourceType: 'RESUME_EXTRACTED',
          sourceDocumentId: resumeDocId,
          evidenceIds: aEvIds,
          extractionVersion,
          verificationStatus: determineVerificationStatus(aEvIds, evidenceRegistry),
          createdAt: nowIso,
        });
      }

      for (const tech of exp.technologies || []) {
        const aliasInfo = resolveSkillAlias(tech.name);
        const tEvIds = registerFactEvidence(evidenceRegistry, tech.evidence, resumeDocId);
        facts.push({
          factId: makeFactId('RESUME_EXTRACTED', 'SKILL', `exp:${i}:${tech.name}`),
          factType: 'SKILL',
          value: tech.name,
          metadata: {
            canonicalName: aliasInfo.canonicalName,
            normalizedToken: aliasInfo.normalizedToken,
            category: aliasInfo.category,
            classification: tech.classification || 'EXPLICIT',
            context: `${title} at ${company}`,
          },
          sourceType: 'RESUME_EXTRACTED',
          sourceDocumentId: resumeDocId,
          evidenceIds: tEvIds,
          extractionVersion,
          verificationStatus: determineVerificationStatus(tEvIds, evidenceRegistry),
          createdAt: nowIso,
        });
      }
    }

    for (const skill of resumeData.skills || []) {
      const aliasInfo = resolveSkillAlias(skill.name);
      const sEvIds = registerFactEvidence(evidenceRegistry, skill.evidence, resumeDocId);
      facts.push({
        factId: makeFactId('RESUME_EXTRACTED', 'SKILL', `top:${skill.name}:${skill.classification}`),
        factType: 'SKILL',
        value: skill.name,
        metadata: {
          canonicalName: aliasInfo.canonicalName,
          normalizedToken: aliasInfo.normalizedToken,
          category: skill.category || aliasInfo.category,
          classification: skill.classification || 'EXPLICIT',
          context: skill.context || null,
        },
        sourceType: 'RESUME_EXTRACTED',
        sourceDocumentId: resumeDocId,
        evidenceIds: sEvIds,
        extractionVersion,
        verificationStatus: determineVerificationStatus(sEvIds, evidenceRegistry),
        createdAt: nowIso,
      });
    }

    for (let p = 0; p < (resumeData.projects || []).length; p++) {
      const proj = resumeData.projects[p];
      const pEvIds = registerFactEvidence(evidenceRegistry, proj.evidence, resumeDocId);
      facts.push({
        factId: makeFactId('RESUME_EXTRACTED', 'PROJECT', `${p}:${proj.name}`),
        factType: 'PROJECT',
        value: proj.name,
        metadata: {
          description: proj.description || null,
          technologies: proj.technologies || [],
          responsibilities: proj.responsibilities || [],
          outcomes: proj.outcomes || [],
        },
        sourceType: 'RESUME_EXTRACTED',
        sourceDocumentId: resumeDocId,
        evidenceIds: pEvIds,
        extractionVersion,
        verificationStatus: determineVerificationStatus(pEvIds, evidenceRegistry),
        createdAt: nowIso,
      });
    }

    for (let e = 0; e < (resumeData.education || []).length; e++) {
      const edu = resumeData.education[e];
      const eEvIds = registerFactEvidence(evidenceRegistry, edu.evidence, resumeDocId);
      facts.push({
        factId: makeFactId('RESUME_EXTRACTED', 'EDUCATION', `${e}:${edu.degree || ''}:${edu.institution || ''}`),
        factType: 'EDUCATION',
        value: [edu.degree, edu.fieldOfStudy, edu.institution].filter(Boolean).join(' - ') || 'Education entry',
        metadata: {
          institution: edu.institution || null,
          degree: edu.degree || null,
          fieldOfStudy: edu.fieldOfStudy || null,
          startYear: edu.startYear || null,
          endYear: edu.endYear || null,
        },
        sourceType: 'RESUME_EXTRACTED',
        sourceDocumentId: resumeDocId,
        evidenceIds: eEvIds,
        extractionVersion,
        verificationStatus: determineVerificationStatus(eEvIds, evidenceRegistry),
        createdAt: nowIso,
      });
    }

    for (let c = 0; c < (resumeData.certifications || []).length; c++) {
      const cert = resumeData.certifications[c];
      const cEvIds = registerFactEvidence(evidenceRegistry, cert.evidence, resumeDocId);
      facts.push({
        factId: makeFactId('RESUME_EXTRACTED', 'CERTIFICATION', `${c}:${cert.name || ''}`),
        factType: 'CERTIFICATION',
        value: cert.name || 'Certification',
        metadata: { issuer: cert.issuer || null, issueDate: cert.issueDate || null },
        sourceType: 'RESUME_EXTRACTED',
        sourceDocumentId: resumeDocId,
        evidenceIds: cEvIds,
        extractionVersion,
        verificationStatus: determineVerificationStatus(cEvIds, evidenceRegistry),
        createdAt: nowIso,
      });
    }

    for (const domain of resumeData.additionalInformation?.domainExperience || []) {
      facts.push({
        factId: makeFactId('RESUME_EXTRACTED', 'DOMAIN_EXPERIENCE', domain),
        factType: 'DOMAIN_EXPERIENCE',
        value: domain,
        metadata: {},
        sourceType: 'RESUME_EXTRACTED',
        sourceDocumentId: resumeDocId,
        evidenceIds: [],
        extractionVersion,
        verificationStatus: 'EVIDENCED',
        createdAt: nowIso,
      });
    }
  }

  return {
    facts,
    evidenceRegistry,
  };
};

/**
 * Strip PII and shrink payload before sending candidate facts to the LLM.
 */
const toLlmMinimizedFacts = (facts = []) =>
  facts
    .filter((f) => ['SKILL', 'RESPONSIBILITY', 'ACHIEVEMENT', 'PROJECT', 'EMPLOYMENT', 'DOMAIN_EXPERIENCE', 'EDUCATION', 'CERTIFICATION'].includes(f.factType))
    .map((f) => ({
      factId: f.factId,
      factType: f.factType,
      sourceType: f.sourceType,
      value: String(f.value || '').slice(0, 300),
      technologies: f.metadata?.technologies || undefined,
      evidenceIds: f.evidenceIds || [],
    }));

module.exports = {
  buildCandidateFacts,
  toLlmMinimizedFacts,
  makeFactId,
};
