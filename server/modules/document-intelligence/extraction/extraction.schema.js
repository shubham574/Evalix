const { z } = require('zod');

const EVIDENCE_STATUSES = [
  'EXPLICIT',
  'DERIVED',
  'INFERRED',
  'AMBIGUOUS',
  'NOT_FOUND',
  'UNVERIFIED',
];

const EvidenceItemSchema = z.object({
  documentId: z.string().min(1),
  blockId: z.string().min(1),
  pageNumber: z.number().int().min(1).nullable().default(null),
  paragraphIndex: z.number().int().min(0).nullable().default(null),
  sectionHeading: z.string().nullable().default(null),
  quote: z.string().min(1),
  sourceType: z.enum(['RESUME', 'JOB_DESCRIPTION']),
  verificationStatus: z.enum(EVIDENCE_STATUSES).default('EXPLICIT'),
});

const ParsedBlockSchema = z.object({
  blockId: z.string().min(1),
  blockType: z.enum(['HEADING', 'PARAGRAPH', 'LIST_ITEM', 'TABLE', 'TEXT']),
  pageNumber: z.number().int().min(1).nullable().default(null),
  paragraphIndex: z.number().int().min(0).nullable().default(null),
  sectionHeading: z.string().nullable().default(null),
  text: z.string(),
});

const ParsedDocumentSchema = z.object({
  documentId: z.string().min(1),
  documentType: z.enum(['RESUME', 'JOB_DESCRIPTION']),
  parser: z.enum(['pdf', 'docx', 'text']),
  status: z.enum(['PARSED', 'OCR_REQUIRED', 'REJECTED']),
  reason: z.string().optional(),
  blocks: z.array(ParsedBlockSchema).default([]),
  metadata: z
    .object({
      pageCount: z.number().int().min(0).default(0),
      emptyPageCount: z.number().int().min(0).default(0),
      paragraphCount: z.number().int().min(0).default(0),
      totalCharacters: z.number().int().min(0).default(0),
      truncated: z.boolean().default(false),
    })
    .default({}),
});

module.exports = {
  EVIDENCE_STATUSES,
  EvidenceItemSchema,
  ParsedBlockSchema,
  ParsedDocumentSchema,
};
