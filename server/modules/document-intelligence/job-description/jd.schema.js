const { z } = require('zod');
const { EvidenceItemSchema } = require('../extraction/extraction.schema');

const EvidencedValueSchema = (valueSchema) =>
  z.object({
    value: valueSchema.nullable().default(null),
    evidence: z.array(EvidenceItemSchema).default([]),
  });

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
      employmentType: z.string().nullable().default(null),
      location: z.string().nullable().default(null),
      workArrangement: z.string().nullable().default(null),
    })
    .default({}),
  responsibilities: z
    .array(
      z.object({
        text: z.string(),
        priority: z.enum(['CORE', 'SECONDARY', 'OPTIONAL']).default('CORE'),
        evidence: z.array(EvidenceItemSchema).default([]),
      })
    )
    .default([]),
  skills: z
    .array(
      z.object({
        name: z.string().min(1),
        category: z.string().default('TECHNICAL'),
        requirementType: z.enum(['MUST_HAVE', 'PREFERRED', 'OPTIONAL']).default('MUST_HAVE'),
        importance: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
        evidence: z.array(EvidenceItemSchema).default([]),
      })
    )
    .default([]),
  technicalCompetencies: z.array(z.string()).default([]),
  functionalCompetencies: z.array(z.string()).default([]),
  behaviouralCompetencies: z.array(z.string()).default([]),
  requiredQualifications: z.array(z.string()).default([]),
  preferredQualifications: z.array(z.string()).default([]),
  domainKnowledge: z.array(z.string()).default([]),
  expectedOutcomes: z.array(z.string()).default([]),
  ambiguities: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
  validationWarnings: z.array(z.string()).default([]),
});

module.exports = {
  JobDescriptionExtractionSchema,
};
