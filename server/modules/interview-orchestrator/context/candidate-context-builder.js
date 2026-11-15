const mongoose = require('mongoose');
const { CandidateJobAnalysis } = require('../../candidate-intelligence/analysis/candidateJobAnalysis.model');

/**
 * Builds a structured, compact, trusted CandidateContext object
 * from Module 3 (CandidateJobAnalysis) and Module 4 (InterviewBlueprint).
 *
 * Product Principle: EVALIX is a student practice & coaching platform.
 * Facts are strictly extracted from verified data without fabrication.
 */
const buildCandidateContext = ({ session, internalBlueprint, analysisDoc = null }) => {
  const analysis = analysisDoc || {};
  const profileSnapshot =
    analysis.reviewedProfileSnapshot || analysis.candidateProfileSnapshot || {};
  const jobReqSnapshot = analysis.jobRequirementSnapshot || {};
  const rawFacts = Array.isArray(profileSnapshot.facts) ? profileSnapshot.facts : [];

  // 1. Target Role & Seniority
  const targetRole =
    internalBlueprint.targetRole ||
    jobReqSnapshot.jobTitle ||
    session.targetRole ||
    'Software Engineer';
  const seniorityLevel =
    internalBlueprint.seniorityLevel ||
    jobReqSnapshot.seniorityLevel ||
    session.seniorityLevel ||
    'MID';

  // 2. Verified Projects
  const projectFacts = rawFacts.filter(
    (f) =>
      f.factType === 'PROJECT' &&
      !f.excludedByCandidate &&
      f.verificationStatus !== 'UNVERIFIED'
  );

  const seenProjectNames = new Set();
  const verifiedProjects = [];

  for (const f of projectFacts) {
    const name = String(f.value || '').trim();
    if (!name || seenProjectNames.has(name.toLowerCase())) continue;
    seenProjectNames.add(name.toLowerCase());

    const meta = f.metadata || {};
    verifiedProjects.push({
      factId: f.factId,
      name,
      description: meta.description ? String(meta.description).slice(0, 300) : null,
      technologies: Array.isArray(meta.technologies)
        ? meta.technologies.slice(0, 8).map((t) => String(t).trim())
        : [],
      personalContribution: Array.isArray(meta.responsibilities) && meta.responsibilities.length > 0
        ? String(meta.responsibilities[0]).slice(0, 200)
        : null,
      outcomes: Array.isArray(meta.outcomes) ? meta.outcomes.slice(0, 3) : [],
      evidenceIds: f.evidenceIds || [],
      verificationStatus: f.verificationStatus,
    });
  }

  // Also check candidateProfileSnapshot.candidateProjects if not already included
  if (Array.isArray(profileSnapshot.candidateProjects)) {
    for (const p of profileSnapshot.candidateProjects) {
      const name = String(p.projectTitle || p.name || '').trim();
      if (!name || seenProjectNames.has(name.toLowerCase())) continue;
      seenProjectNames.add(name.toLowerCase());
      verifiedProjects.push({
        factId: p._id ? String(p._id) : null,
        name,
        description: p.projectDescription ? String(p.projectDescription).slice(0, 300) : null,
        technologies: Array.isArray(p.technologies)
          ? p.technologies.slice(0, 8).map((t) => String(t).trim())
          : [],
        personalContribution: p.candidateResponsibility ? String(p.candidateResponsibility).slice(0, 200) : null,
        outcomes: [],
        evidenceIds: [],
        verificationStatus: 'SELF_REPORTED',
      });
    }
  }

  // 3. Verified Skills
  const skillFacts = rawFacts.filter(
    (f) =>
      f.factType === 'SKILL' &&
      !f.excludedByCandidate &&
      f.verificationStatus !== 'UNVERIFIED'
  );

  const seenSkillNames = new Set();
  const verifiedSkills = [];

  for (const f of skillFacts) {
    const name = String(f.metadata?.canonicalName || f.value || '').trim();
    if (!name || seenSkillNames.has(name.toLowerCase())) continue;
    seenSkillNames.add(name.toLowerCase());

    verifiedSkills.push({
      name,
      category: f.metadata?.category || 'TECHNICAL',
      classification: f.metadata?.classification || 'EXPLICIT',
      verificationStatus: f.verificationStatus,
    });
  }

  // 4. Work Experience
  const employmentFacts = rawFacts.filter(
    (f) => f.factType === 'EMPLOYMENT' && !f.excludedByCandidate
  );
  const relevantExperience = employmentFacts.slice(0, 5).map((f) => {
    const meta = f.metadata || {};
    return {
      title: meta.jobTitle || f.value,
      company: meta.companyName || 'Organization',
      startDate: meta.startDate || null,
      endDate: meta.isCurrent ? 'Present' : meta.endDate || null,
      description: meta.description ? String(meta.description).slice(0, 200) : '',
    };
  });

  // 5. Job Requirements
  const rawRequirements = Array.isArray(jobReqSnapshot.requirements)
    ? jobReqSnapshot.requirements
    : [];
  const jobRequirements = rawRequirements.map((r) => ({
    requirementId: r.requirementId,
    name: r.normalizedName || r.originalWording,
    category: r.category || 'TECHNICAL',
    requirementType: r.requirementType || 'MUST_HAVE',
    importance: r.importance || 'MEDIUM',
  }));

  // 6. Excluded Requirements (Strict Grounding)
  const excludedRequirements = Array.isArray(internalBlueprint.excludedRequirements)
    ? internalBlueprint.excludedRequirements
    : [];

  return {
    targetRole,
    seniorityLevel,
    hasProjects: verifiedProjects.length > 0,
    hasVerifiedProjects: verifiedProjects.length > 0,
    verifiedProjects,
    verifiedSkills,
    relevantExperience,
    jobRequirements,
    competencies: internalBlueprint.competencies || [],
    excludedRequirements,
  };
};

/**
 * Build a compact, focused context slice for the current question
 * to avoid overloading the LLM prompt with unnecessary raw data.
 */
const getRelevantContextForQuestion = (candidateContext, currentQuestion, currentStage) => {
  if (!candidateContext) return {};

  const stageType = String(currentStage?.stageType || '').toUpperCase();
  const questionType = String(currentQuestion?.questionType || '').toUpperCase();

  // Project Deep Dive Stage
  if (stageType.includes('PROJECT') || questionType.includes('PROJECT')) {
    if (candidateContext.hasVerifiedProjects) {
      return {
        contextType: 'PROJECT_DEEP_DIVE',
        hasVerifiedProjects: true,
        availableProjects: candidateContext.verifiedProjects.map((p) => ({
          name: p.name,
          description: p.description,
          technologies: p.technologies,
          personalContribution: p.personalContribution,
        })),
        instruction:
          'Ask specifically about one of the candidate verified projects above. Mention its name, architecture, technologies, and the candidate personal contribution.',
      };
    }
    return {
      contextType: 'PROJECT_DEEP_DIVE',
      hasVerifiedProjects: false,
      availableProjects: [],
      instruction:
        'The candidate has no verified project on file. Ask the student to choose and name a technical project they have worked on recently.',
    };
  }

  // Technical Assessment Stage
  if (stageType.includes('TECHNICAL') || questionType.includes('TECHNICAL')) {
    const relevantSkills = candidateContext.verifiedSkills.map((s) => s.name);
    return {
      contextType: 'TECHNICAL_ASSESSMENT',
      targetRole: candidateContext.targetRole,
      candidateVerifiedSkills: relevantSkills,
      jobRequirements: candidateContext.jobRequirements.slice(0, 10).map((r) => `${r.name} (${r.requirementType})`),
      instruction:
        'Ground questions strictly in the candidate verified skills and relevant job requirements. NEVER introduce technologies not present in candidate skills or job requirements.',
    };
  }

  // Introduction / Background Stage
  if (stageType.includes('INTRO') || stageType.includes('BACKGROUND')) {
    return {
      contextType: 'INTRODUCTION',
      targetRole: candidateContext.targetRole,
      seniorityLevel: candidateContext.seniorityLevel,
      topSkills: candidateContext.verifiedSkills.slice(0, 6).map((s) => s.name),
      recentExperience: candidateContext.relevantExperience.slice(0, 2),
    };
  }

  // Behavioural / Collaboration Stage
  return {
    contextType: 'BEHAVIOURAL',
    recentExperience: candidateContext.relevantExperience.slice(0, 3),
    availableProjects: candidateContext.verifiedProjects.slice(0, 2).map((p) => p.name),
  };
};

module.exports = {
  buildCandidateContext,
  getRelevantContextForQuestion,
};
