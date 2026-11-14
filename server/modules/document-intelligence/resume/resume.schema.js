const { z } = require('zod');
const { EvidenceItemSchema } = require('../extraction/extraction.schema');

const DATE_PRECISIONS = ['DAY', 'MONTH', 'YEAR', 'OPEN_ENDED', 'UNKNOWN'];
const SKILL_CLASSIFICATIONS = ['EXPLICIT', 'PROJECT_EVIDENCED', 'INFERRED'];

const EvidencedStringSchema = z.object({
  value: z.string().nullable().default(null),
  evidence: z.array(EvidenceItemSchema).default([]),
});

const DateFieldSchema = z.object({
  raw: z.string().nullable().default(null),
  normalized: z.string().nullable().default(null),
  precision: z.enum(DATE_PRECISIONS).default('UNKNOWN'),
  evidence: z.array(EvidenceItemSchema).default([]),
});

const WorkExperienceItemSchema = z.object({
  companyName: EvidencedStringSchema.default({ value: null, evidence: [] }),
  jobTitle: EvidencedStringSchema.default({ value: null, evidence: [] }),
  employmentType: z.string().nullable().default(null),
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
});

const ResumeSkillSchema = z.object({
  name: z.string().min(1),
  category: z.string().default('GENERAL'),
  classification: z.enum(SKILL_CLASSIFICATIONS).default('EXPLICIT'),
  context: z.string().nullable().default(null),
  evidence: z.array(EvidenceItemSchema).default([]),
});

const ResumeProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  technologies: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  outcomes: z.array(z.string()).default([]),
  projectUrl: z.string().nullable().default(null),
  evidence: z.array(EvidenceItemSchema).default([]),
});

const ResumeEducationSchema = z.object({
  institution: z.string().nullable().default(null),
  degree: z.string().nullable().default(null),
  fieldOfStudy: z.string().nullable().default(null),
  startYear: z.string().nullable().default(null),
  endYear: z.string().nullable().default(null),
  evidence: z.array(EvidenceItemSchema).default([]),
});

const ResumeCertificationSchema = z.object({
  name: z.string().nullable().default(null),
  issuer: z.string().nullable().default(null),
  issueDate: z.string().nullable().default(null),
  evidence: z.array(EvidenceItemSchema).default([]),
});

const ResumeExtractionSchema = z.object({
  documentId: z.string().min(1),
  documentType: z.literal('RESUME').default('RESUME'),
  schemaVersion: z.literal('1.0').default('1.0'),
  extractionStatus: z
    .enum(['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'PARTIAL', 'OCR_REQUIRED'])
    .default('COMPLETED'),
  personalInformation: z
    .object({
      fullName: z.string().nullable().default(null),
      email: z.string().nullable().default(null),
      phone: z.string().nullable().default(null),
      location: z.string().nullable().default(null),
    })
    .default({}),
  professionalSummary: z
    .object({
      text: z.string().nullable().default(null),
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
      languages: z.array(z.string()).default([]),
      leadershipExperience: z.array(z.string()).default([]),
      domainExperience: z.array(z.string()).default([]),
    })
    .default({}),
  missingInformation: z.array(z.string()).default([]),
  ambiguities: z.array(z.string()).default([]),
  validationWarnings: z.array(z.string()).default([]),
});

module.exports = {
  ResumeExtractionSchema,
  DATE_PRECISIONS,
  SKILL_CLASSIFICATIONS,
};
