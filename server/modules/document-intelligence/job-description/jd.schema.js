const { z } = require('zod');
const { EvidenceItemSchema } = require('../extraction/extraction.schema');

const coerceString = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    const candidate =
      val.value ??
      val.name ??
      val.text ??
      val.title ??
      val.type ??
      val.competency ??
      val.qualification ??
      val.domain ??
      val.city ??
      val.location ??
      val.arrangement ??
      val.description;
    if (candidate !== undefined && candidate !== null) {
      return typeof candidate === 'string' ? candidate.trim() : String(candidate);
    }
    for (const [k, v] of Object.entries(val)) {
      if (k !== 'evidence' && typeof v === 'string' && v.trim()) {
        return v.trim();
      }
    }
  }
  return null;
};

const coerceStringArray = (arr) => {
  if (!arr) return [];
  if (!Array.isArray(arr)) {
    const single = coerceString(arr);
    return single ? [single] : [];
  }
  const result = [];
  for (const item of arr) {
    const s = coerceString(item);
    if (s && s.length > 0) {
      result.push(s);
    }
  }
  return result;
};

const RelaxedString = z.preprocess((val) => coerceString(val), z.string().nullable().default(null));
const RelaxedStringArray = z.preprocess((val) => coerceStringArray(val), z.array(z.string()).default([]));

const EvidencedValueSchema = (valueSchema) =>
  z.preprocess(
    (val) => {
      if (val === null || val === undefined) return { value: null, evidence: [] };
      if (typeof val !== 'object' || Array.isArray(val)) {
        return { value: val, evidence: [] };
      }
      return val;
    },
    z.object({
      value: valueSchema.nullable().default(null),
      evidence: z.array(EvidenceItemSchema).default([]),
    })
  );

const JdSkillItemSchema = z.preprocess(
  (item) => {
    if (!item || typeof item !== 'object') {
      const name = coerceString(item) || 'Unknown';
      return { name, category: 'TECHNICAL', requirementType: 'MUST_HAVE', importance: 'MEDIUM', evidence: [] };
    }
    const name = coerceString(item.name || item.skill || item.title || item.value) || 'Unknown';
    let requirementType = (item.requirementType || 'MUST_HAVE').toString().toUpperCase();
    if (!['MUST_HAVE', 'PREFERRED', 'OPTIONAL'].includes(requirementType)) {
      requirementType = requirementType.includes('PREF') || requirementType.includes('NICE') ? 'PREFERRED' : 'MUST_HAVE';
    }
    let importance = (item.importance || 'MEDIUM').toString().toUpperCase();
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(importance)) {
      importance = 'MEDIUM';
    }
    return {
      name,
      category: coerceString(item.category) || 'TECHNICAL',
      requirementType,
      importance,
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
    };
  },
  z.object({
    name: z.string().min(1),
    category: z.string().default('TECHNICAL'),
    requirementType: z.enum(['MUST_HAVE', 'PREFERRED', 'OPTIONAL']).default('MUST_HAVE'),
    importance: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
    evidence: z.array(EvidenceItemSchema).default([]),
  })
);

const JdResponsibilityItemSchema = z.preprocess(
  (item) => {
    if (typeof item === 'string') {
      return { text: item.trim(), priority: 'CORE', evidence: [] };
    }
    if (item && typeof item === 'object') {
      const text = coerceString(item.text || item.description || item.responsibility || item.value) || '';
      let priority = (item.priority || 'CORE').toString().toUpperCase();
      if (!['CORE', 'SECONDARY', 'OPTIONAL'].includes(priority)) {
        priority = 'CORE';
      }
      return {
        text,
        priority,
        evidence: Array.isArray(item.evidence) ? item.evidence : [],
      };
    }
    return { text: '', priority: 'CORE', evidence: [] };
  },
  z.object({
    text: z.string(),
    priority: z.enum(['CORE', 'SECONDARY', 'OPTIONAL']).default('CORE'),
    evidence: z.array(EvidenceItemSchema).default([]),
  })
);

const JobDescriptionExtractionSchema = z.object({
  documentId: z.string().min(1),
  documentType: z.literal('JOB_DESCRIPTION').default('JOB_DESCRIPTION'),
  schemaVersion: z.literal('1.0').default('1.0'),
  extractionStatus: z
    .enum(['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'PARTIAL', 'OCR_REQUIRED'])
    .default('COMPLETED'),
  jobInformation: z
    .object({
      jobTitle: EvidencedValueSchema(z.string()).default({ value: null, evidence: [] }),
      companyName: EvidencedValueSchema(z.string()).default({ value: null, evidence: [] }),
      seniorityLevel: EvidencedValueSchema(z.string()).default({ value: null, evidence: [] }),
      minimumExperienceMonths: EvidencedValueSchema(z.number()).default({ value: null, evidence: [] }),
      maximumExperienceMonths: EvidencedValueSchema(z.number()).default({ value: null, evidence: [] }),
      employmentType: RelaxedString,
      location: RelaxedString,
      workArrangement: RelaxedString,
    })
    .default({}),
  responsibilities: z.array(JdResponsibilityItemSchema).default([]),
  skills: z.array(JdSkillItemSchema).default([]),
  technicalCompetencies: RelaxedStringArray,
  functionalCompetencies: RelaxedStringArray,
  behaviouralCompetencies: RelaxedStringArray,
  requiredQualifications: RelaxedStringArray,
  preferredQualifications: RelaxedStringArray,
  domainKnowledge: RelaxedStringArray,
  expectedOutcomes: RelaxedStringArray,
  ambiguities: RelaxedStringArray,
  missingInformation: RelaxedStringArray,
  validationWarnings: RelaxedStringArray,
});

module.exports = {
  JobDescriptionExtractionSchema,
  coerceString,
  coerceStringArray,
};
