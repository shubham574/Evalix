const { z } = require('zod');
const { EvidenceItemSchema } = require('../extraction/extraction.schema');
const { coerceString, coerceStringArray } = require('../job-description/jd.schema');

const DATE_PRECISIONS = ['DAY', 'MONTH', 'YEAR', 'OPEN_ENDED', 'UNKNOWN'];
const SKILL_CLASSIFICATIONS = ['EXPLICIT', 'PROJECT_EVIDENCED', 'INFERRED'];

const RelaxedString = z.preprocess((val) => coerceString(val), z.string().nullable().default(null));
const RelaxedStringArray = z.preprocess((val) => coerceStringArray(val), z.array(z.string()).default([]));

const EvidencedStringSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined) return { value: null, evidence: [] };
    if (typeof val !== 'object' || Array.isArray(val)) {
      return { value: coerceString(val), evidence: [] };
    }
    return {
      value: coerceString(val.value),
      evidence: Array.isArray(val.evidence) ? val.evidence : [],
    };
  },
  z.object({
    value: z.string().nullable().default(null),
    evidence: z.array(EvidenceItemSchema).default([]),
  })
);

const DateFieldSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined) {
      return { raw: null, normalized: null, precision: 'UNKNOWN', evidence: [] };
    }
    if (typeof val === 'string') {
      return { raw: val, normalized: null, precision: 'UNKNOWN', evidence: [] };
    }
    if (typeof val === 'object') {
      const precisionRaw = (val.precision || 'UNKNOWN').toString().toUpperCase();
      const precision = DATE_PRECISIONS.includes(precisionRaw) ? precisionRaw : 'UNKNOWN';
      return {
        raw: coerceString(val.raw) || (typeof val.startDate === 'string' ? val.startDate : null),
        normalized: coerceString(val.normalized),
        precision,
        evidence: Array.isArray(val.evidence) ? val.evidence : [],
      };
    }
    return val;
  },
  z.object({
    raw: z.string().nullable().default(null),
    normalized: z.string().nullable().default(null),
    precision: z.enum(DATE_PRECISIONS).default('UNKNOWN'),
    evidence: z.array(EvidenceItemSchema).default([]),
  })
);

const WorkExperienceItemSchema = z.preprocess(
  (item) => {
    if (!item || typeof item !== 'object') return item;
    return {
      ...item,
      responsibilities: Array.isArray(item.responsibilities)
        ? item.responsibilities.map((r) =>
            typeof r === 'string'
              ? { text: r, evidence: [] }
              : { text: coerceString(r?.text || r?.description || r?.value) || '', evidence: Array.isArray(r?.evidence) ? r.evidence : [] }
          )
        : [],
      achievements: Array.isArray(item.achievements)
        ? item.achievements.map((a) =>
            typeof a === 'string'
              ? { text: a, metrics: null, evidence: [] }
              : {
                  text: coerceString(a?.text || a?.description || a?.value) || '',
                  metrics: coerceString(a?.metrics),
                  evidence: Array.isArray(a?.evidence) ? a.evidence : [],
                }
          )
        : [],
      technologies: Array.isArray(item.technologies)
        ? item.technologies.map((t) => {
            if (typeof t === 'string') {
              return { name: t, classification: 'EXPLICIT', evidence: [] };
            }
            const name = coerceString(t?.name || t?.tech || t?.skill || t?.value) || '';
            const classification = SKILL_CLASSIFICATIONS.includes(t?.classification)
              ? t.classification
              : 'EXPLICIT';
            return {
              name,
              classification,
              evidence: Array.isArray(t?.evidence) ? t.evidence : [],
            };
          })
        : [],
    };
  },
  z.object({
    companyName: EvidencedStringSchema.default({ value: null, evidence: [] }),
    jobTitle: EvidencedStringSchema.default({ value: null, evidence: [] }),
    employmentType: RelaxedString,
    startDate: DateFieldSchema.default({ raw: null, normalized: null, precision: 'UNKNOWN', evidence: [] }),
    endDate: DateFieldSchema.default({ raw: null, normalized: null, precision: 'UNKNOWN', evidence: [] }),
    isCurrent: z.boolean().default(false),
    responsibilities: z
      .array(
        z.object({
          text: z.string(),
          evidence: z.array(EvidenceItemSchema).default([]),
        })
      )
      .default([]),
    achievements: z
      .array(
        z.object({
          text: z.string(),
          metrics: z.string().nullable().default(null),
          evidence: z.array(EvidenceItemSchema).default([]),
        })
      )
      .default([]),
    technologies: z
      .array(
        z.object({
          name: z.string(),
          classification: z.enum(SKILL_CLASSIFICATIONS).default('EXPLICIT'),
          evidence: z.array(EvidenceItemSchema).default([]),
        })
      )
      .default([]),
  })
);

const ResumeSkillSchema = z.preprocess(
  (item) => {
    if (!item) return item;
    if (typeof item === 'string') {
      return { name: item, category: 'GENERAL', classification: 'EXPLICIT', context: null, evidence: [] };
    }
    const name = coerceString(item.name || item.skill || item.title || item.value) || 'Unknown';
    const classification = SKILL_CLASSIFICATIONS.includes(item.classification)
      ? item.classification
      : 'EXPLICIT';
    return {
      name,
      category: coerceString(item.category) || 'GENERAL',
      classification,
      context: coerceString(item.context),
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
    };
  },
  z.object({
    name: z.string().min(1),
    category: z.string().default('GENERAL'),
    classification: z.enum(SKILL_CLASSIFICATIONS).default('EXPLICIT'),
    context: z.string().nullable().default(null),
    evidence: z.array(EvidenceItemSchema).default([]),
  })
);

const ResumeProjectSchema = z.preprocess(
  (item) => {
    if (!item || typeof item !== 'object') return item;
    return {
      name: coerceString(item.name || item.title || item.project || item.value) || 'Project',
      description: coerceString(item.description),
      technologies: coerceStringArray(item.technologies),
      responsibilities: coerceStringArray(item.responsibilities),
      outcomes: coerceStringArray(item.outcomes),
      projectUrl: coerceString(item.projectUrl || item.url),
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
    };
  },
  z.object({
    name: z.string().min(1),
    description: z.string().nullable().default(null),
    technologies: RelaxedStringArray,
    responsibilities: RelaxedStringArray,
    outcomes: RelaxedStringArray,
    projectUrl: z.string().nullable().default(null),
    evidence: z.array(EvidenceItemSchema).default([]),
  })
);

const ResumeEducationSchema = z.preprocess(
  (item) => {
    if (!item || typeof item !== 'object') return item;
    return {
      institution: coerceString(item.institution || item.school || item.university || item.college),
      degree: coerceString(item.degree),
      fieldOfStudy: coerceString(item.fieldOfStudy || item.major || item.field),
      startYear: coerceString(item.startYear),
      endYear: coerceString(item.endYear || item.graduationYear || item.year),
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
    };
  },
  z.object({
    institution: z.string().nullable().default(null),
    degree: z.string().nullable().default(null),
    fieldOfStudy: z.string().nullable().default(null),
    startYear: z.string().nullable().default(null),
    endYear: z.string().nullable().default(null),
    evidence: z.array(EvidenceItemSchema).default([]),
  })
);

const ResumeCertificationSchema = z.preprocess(
  (item) => {
    if (!item || typeof item !== 'object') return item;
    return {
      name: coerceString(item.name || item.title || item.certificate),
      issuer: coerceString(item.issuer || item.organization || item.authority),
      issueDate: coerceString(item.issueDate || item.date || item.year),
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
    };
  },
  z.object({
    name: z.string().nullable().default(null),
    issuer: z.string().nullable().default(null),
    issueDate: z.string().nullable().default(null),
    evidence: z.array(EvidenceItemSchema).default([]),
  })
);

const ResumeExtractionSchema = z.object({
  documentId: z.string().min(1),
  documentType: z.literal('RESUME').default('RESUME'),
  schemaVersion: z.literal('1.0').default('1.0'),
  extractionStatus: z
    .enum(['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'PARTIAL', 'OCR_REQUIRED'])
    .default('COMPLETED'),
  personalInformation: z
    .object({
      fullName: RelaxedString,
      email: RelaxedString,
      phone: RelaxedString,
      location: RelaxedString,
    })
    .default({}),
  professionalSummary: z
    .object({
      text: RelaxedString,
      evidence: z.array(EvidenceItemSchema).default([]),
    })
    .default({ text: null, evidence: [] }),
  professionalHeadline: EvidencedStringSchema.default({ value: null, evidence: [] }),
  totalExperience: z
    .object({
      reportedByCandidate: z.number().nullable().default(null),
      derivedFromTimeline: z.number().nullable().default(null),
      unit: z.literal('MONTHS').default('MONTHS'),
      evidence: z.array(EvidenceItemSchema).default([]),
      calculationStatus: z
        .enum(['NOT_CALCULATED', 'CALCULATED', 'PARTIAL', 'INSUFFICIENT_DATES'])
        .default('NOT_CALCULATED'),
    })
    .default({}),
  workExperience: z.array(WorkExperienceItemSchema).default([]),
  skills: z.array(ResumeSkillSchema).default([]),
  projects: z.array(ResumeProjectSchema).default([]),
  education: z.array(ResumeEducationSchema).default([]),
  certifications: z.array(ResumeCertificationSchema).default([]),
  additionalInformation: z
    .object({
      languages: RelaxedStringArray,
      leadershipExperience: RelaxedStringArray,
      domainExperience: RelaxedStringArray,
    })
    .default({}),
  missingInformation: RelaxedStringArray,
  ambiguities: RelaxedStringArray,
  validationWarnings: RelaxedStringArray,
});

module.exports = {
  ResumeExtractionSchema,
  DATE_PRECISIONS,
  SKILL_CLASSIFICATIONS,
  RelaxedString,
  RelaxedStringArray,
};
