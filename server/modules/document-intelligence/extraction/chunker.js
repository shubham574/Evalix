const env = require('../../../config/env');

/**
 * Format parsed blocks into a structured, untrusted-data representation with block anchors
 * so the LLM can cite exact blockId, pageNumber, and paragraphIndex.
 */
const formatBlocksForPrompt = (blocks) =>
  blocks
    .map(
      (b) =>
        `[BLOCK id="${b.blockId}" type="${b.blockType}" page=${b.pageNumber ?? 'null'} para=${b.paragraphIndex ?? 'null'} section="${b.sectionHeading || ''}"]\n${b.text}\n[/BLOCK]`
    )
    .join('\n\n');

/**
 * Split a ParsedDocument's blocks into deterministic, section-aware overlapping chunks
 * for long documents without splitting individual blocks mid-sentence.
 */
const chunkParsedBlocks = (
  blocks,
  {
    maxChunkChars = env.DOCUMENT_EXTRACTION_CHUNK_SIZE,
    overlapChars = env.DOCUMENT_EXTRACTION_CHUNK_OVERLAP,
  } = {}
) => {
  if (!blocks || blocks.length === 0) return [];

  const chunks = [];
  let current = [];
  let currentLen = 0;

  for (const block of blocks) {
    const blockLen = block.text.length + 80; // account for anchor metadata
    if (current.length > 0 && currentLen + blockLen > maxChunkChars) {
      chunks.push(current);

      // Build overlap from trailing blocks up to overlapChars
      const overlap = [];
      let overlapLen = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const b = current[i];
        if (overlapLen + b.text.length > overlapChars && overlap.length > 0) break;
        overlap.unshift(b);
        overlapLen += b.text.length;
      }
      current = overlap;
      currentLen = overlapLen;
    }

    current.push(block);
    currentLen += blockLen;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
};

/**
 * Deterministically merge multiple ResumeExtraction results from chunks.
 */
const mergeResumeExtractions = (extractions) => {
  if (extractions.length === 1) return extractions[0];

  const base = JSON.parse(JSON.stringify(extractions[0]));
  const seenSkills = new Set(base.skills.map((s) => s.name.toLowerCase()));
  const seenProjects = new Set(base.projects.map((p) => p.name.toLowerCase()));
  const seenEdu = new Set(
    base.education.map((e) => `${(e.institution || '').toLowerCase()}|${(e.degree || '').toLowerCase()}`)
  );
  const seenCerts = new Set(base.certifications.map((c) => (c.name || '').toLowerCase()));
  const seenWork = new Set(
    base.workExperience.map(
      (w) =>
        `${(w.companyName?.value || '').toLowerCase()}|${(w.jobTitle?.value || '').toLowerCase()}|${w.startDate?.raw || ''}`
    )
  );

  for (let i = 1; i < extractions.length; i++) {
    const next = extractions[i];
    // Fill personalInformation nulls conservatively
    for (const k of ['fullName', 'email', 'phone', 'location']) {
      if (!base.personalInformation[k] && next.personalInformation?.[k]) {
        base.personalInformation[k] = next.personalInformation[k];
      }
    }
    if (!base.professionalSummary?.text && next.professionalSummary?.text) {
      base.professionalSummary = next.professionalSummary;
    }
    if (!base.professionalHeadline?.value && next.professionalHeadline?.value) {
      base.professionalHeadline = next.professionalHeadline;
    }

    for (const w of next.workExperience || []) {
      const key = `${(w.companyName?.value || '').toLowerCase()}|${(w.jobTitle?.value || '').toLowerCase()}|${w.startDate?.raw || ''}`;
      if (!seenWork.has(key)) {
        seenWork.add(key);
        base.workExperience.push(w);
      }
    }
    for (const s of next.skills || []) {
      const key = s.name.toLowerCase();
      if (!seenSkills.has(key)) {
        seenSkills.add(key);
        base.skills.push(s);
      }
    }
    for (const p of next.projects || []) {
      const key = p.name.toLowerCase();
      if (!seenProjects.has(key)) {
        seenProjects.add(key);
        base.projects.push(p);
      }
    }
    for (const e of next.education || []) {
      const key = `${(e.institution || '').toLowerCase()}|${(e.degree || '').toLowerCase()}`;
      if (!seenEdu.has(key)) {
        seenEdu.add(key);
        base.education.push(e);
      }
    }
    for (const c of next.certifications || []) {
      const key = (c.name || '').toLowerCase();
      if (key && !seenCerts.has(key)) {
        seenCerts.add(key);
        base.certifications.push(c);
      }
    }

    base.additionalInformation.languages = [
      ...new Set([...base.additionalInformation.languages, ...(next.additionalInformation?.languages || [])]),
    ];
    base.additionalInformation.leadershipExperience = [
      ...new Set([
        ...base.additionalInformation.leadershipExperience,
        ...(next.additionalInformation?.leadershipExperience || []),
      ]),
    ];
    base.additionalInformation.domainExperience = [
      ...new Set([
        ...base.additionalInformation.domainExperience,
        ...(next.additionalInformation?.domainExperience || []),
      ]),
    ];
    base.missingInformation = [...new Set([...base.missingInformation, ...(next.missingInformation || [])])];
    base.ambiguities = [...new Set([...base.ambiguities, ...(next.ambiguities || [])])];
    base.validationWarnings = [...new Set([...base.validationWarnings, ...(next.validationWarnings || [])])];
  }

  return base;
};

/**
 * Deterministically merge multiple JobDescriptionExtraction results from chunks.
 */
const mergeJdExtractions = (extractions) => {
  if (extractions.length === 1) return extractions[0];

  const base = JSON.parse(JSON.stringify(extractions[0]));
  const seenResp = new Set(base.responsibilities.map((r) => r.text.toLowerCase()));
  const seenSkills = new Set(base.skills.map((s) => `${s.name.toLowerCase()}|${s.requirementType}`));

  for (let i = 1; i < extractions.length; i++) {
    const next = extractions[i];
    for (const k of ['jobTitle', 'companyName', 'seniorityLevel', 'minimumExperienceMonths', 'maximumExperienceMonths']) {
      if (base.jobInformation[k]?.value === null && next.jobInformation?.[k]?.value !== null) {
        base.jobInformation[k] = next.jobInformation[k];
      }
    }
    for (const k of ['employmentType', 'location', 'workArrangement']) {
      if (!base.jobInformation[k] && next.jobInformation?.[k]) {
        base.jobInformation[k] = next.jobInformation[k];
      }
    }
    for (const r of next.responsibilities || []) {
      if (!seenResp.has(r.text.toLowerCase())) {
        seenResp.add(r.text.toLowerCase());
        base.responsibilities.push(r);
      }
    }
    for (const s of next.skills || []) {
      const key = `${s.name.toLowerCase()}|${s.requirementType}`;
      if (!seenSkills.has(key)) {
        seenSkills.add(key);
        base.skills.push(s);
      }
    }
    for (const arrField of [
      'technicalCompetencies',
      'functionalCompetencies',
      'behaviouralCompetencies',
      'requiredQualifications',
      'preferredQualifications',
      'domainKnowledge',
      'expectedOutcomes',
      'ambiguities',
      'missingInformation',
      'validationWarnings',
    ]) {
      base[arrField] = [...new Set([...(base[arrField] || []), ...(next[arrField] || [])])];
    }
  }

  return base;
};

module.exports = {
  formatBlocksForPrompt,
  chunkParsedBlocks,
  mergeResumeExtractions,
  mergeJdExtractions,
};
