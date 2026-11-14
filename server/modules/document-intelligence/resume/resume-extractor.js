const AppError = require('../../common/errors/AppError');
const { ResumeExtractionSchema } = require('./resume.schema');
const {
  RESUME_PROMPT_VERSION,
  RESUME_SYSTEM_INSTRUCTION,
  buildResumeExtractionPrompt,
} = require('./resume.prompt');
const {
  chunkParsedBlocks,
  formatBlocksForPrompt,
  mergeResumeExtractions,
} = require('../extraction/chunker');
const { validateExtractionEvidence } = require('../evidence/evidence-validator');

const RESUME_EXTRACTOR_VERSION = '1.0.0';

/**
 * Extract and validate structured Resume Intelligence from a ParsedDocument.
 */
const extractResumeIntelligence = async ({
  parsedDoc,
  llmProvider,
  requestId = 'resume-extract',
  signal = undefined,
}) => {
  if (!parsedDoc || parsedDoc.status !== 'PARSED' || !parsedDoc.blocks?.length) {
    throw new AppError(400, 'Parsed resume blocks are required for extraction', 'INVALID_PARSED_DOCUMENT');
  }

  const chunks = chunkParsedBlocks(parsedDoc.blocks);
  const chunkResults = [];
  let totalTokens = 0;
  let providerName = null;
  let modelName = null;

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) {
      const err = new Error('Extraction aborted due to lease loss');
      err.code = 'LEASE_LOST';
      throw err;
    }
    const formattedBlocks = formatBlocksForPrompt(chunks[i]);
    const userPrompt = buildResumeExtractionPrompt({
      documentId: parsedDoc.documentId,
      formattedBlocks,
    });

    const llmRes = await llmProvider.generateStructuredJson({
      systemInstruction: RESUME_SYSTEM_INSTRUCTION,
      userPrompt,
      requestId: `${requestId}-chunk-${i + 1}`,
      signal,
    });

    providerName = llmRes.provider;
    modelName = llmRes.model;
    if (llmRes.usage?.totalTokens) {
      totalTokens += llmRes.usage.totalTokens;
    }

    const raw = {
      ...llmRes.data,
      documentId: String(parsedDoc.documentId),
      documentType: 'RESUME',
      schemaVersion: '1.0',
    };

    const zodParsed = ResumeExtractionSchema.safeParse(raw);
    if (!zodParsed.success) {
      const msg = zodParsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ');
      throw new AppError(422, `Resume extraction failed schema validation: ${msg}`, 'EXTRACTION_SCHEMA_INVALID');
    }

    chunkResults.push(zodParsed.data);
  }

  const merged = mergeResumeExtractions(chunkResults);
  const { validated, warnings } = validateExtractionEvidence(merged, parsedDoc);

  if (warnings.length > 0 && validated.extractionStatus === 'COMPLETED') {
    validated.extractionStatus = 'COMPLETED_WITH_WARNINGS';
  }

  return {
    extraction: validated,
    metadata: {
      extractorVersion: RESUME_EXTRACTOR_VERSION,
      promptVersion: RESUME_PROMPT_VERSION,
      schemaVersion: '1.0',
      provider: providerName,
      model: modelName,
      chunkCount: chunks.length,
      totalTokens,
    },
  };
};

module.exports = {
  RESUME_EXTRACTOR_VERSION,
  extractResumeIntelligence,
};
