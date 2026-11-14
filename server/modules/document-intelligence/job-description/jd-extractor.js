const AppError = require('../../common/errors/AppError');
const { JobDescriptionExtractionSchema } = require('./jd.schema');
const {
  JD_PROMPT_VERSION,
  JD_SYSTEM_INSTRUCTION,
  buildJdExtractionPrompt,
} = require('./jd.prompt');
const {
  chunkParsedBlocks,
  formatBlocksForPrompt,
  mergeJdExtractions,
} = require('../extraction/chunker');
const { validateExtractionEvidence } = require('../evidence/evidence-validator');

const JD_EXTRACTOR_VERSION = '1.0.0';

/**
 * Extract and validate structured Job Description Intelligence from a ParsedDocument.
 */
const extractJdIntelligence = async ({
  parsedDoc,
  llmProvider,
  requestId = 'jd-extract',
}) => {
  if (!parsedDoc || parsedDoc.status !== 'PARSED' || !parsedDoc.blocks?.length) {
    throw new AppError(400, 'Parsed job description blocks are required for extraction', 'INVALID_PARSED_DOCUMENT');
  }

  const chunks = chunkParsedBlocks(parsedDoc.blocks);
  const chunkResults = [];
  let totalTokens = 0;
  let providerName = null;
  let modelName = null;

  for (let i = 0; i < chunks.length; i++) {
    const formattedBlocks = formatBlocksForPrompt(chunks[i]);
    const userPrompt = buildJdExtractionPrompt({
      documentId: parsedDoc.documentId,
      formattedBlocks,
    });

    const llmRes = await llmProvider.generateStructuredJson({
      systemInstruction: JD_SYSTEM_INSTRUCTION,
      userPrompt,
      requestId: `${requestId}-chunk-${i + 1}`,
    });

    providerName = llmRes.provider;
    modelName = llmRes.model;
    if (llmRes.usage?.totalTokens) {
      totalTokens += llmRes.usage.totalTokens;
    }

    const raw = {
      ...llmRes.data,
      documentId: String(parsedDoc.documentId),
      documentType: 'JOB_DESCRIPTION',
      schemaVersion: '1.0',
    };

    const zodParsed = JobDescriptionExtractionSchema.safeParse(raw);
    if (!zodParsed.success) {
      const msg = zodParsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ');
      throw new AppError(422, `JD extraction failed schema validation: ${msg}`, 'EXTRACTION_SCHEMA_INVALID');
    }

    chunkResults.push(zodParsed.data);
  }

  const merged = mergeJdExtractions(chunkResults);
  const { validated, warnings } = validateExtractionEvidence(merged, parsedDoc);

  if (warnings.length > 0 && validated.extractionStatus === 'COMPLETED') {
    validated.extractionStatus = 'COMPLETED_WITH_WARNINGS';
  }

  return {
    extraction: validated,
    metadata: {
      extractorVersion: JD_EXTRACTOR_VERSION,
      promptVersion: JD_PROMPT_VERSION,
      schemaVersion: '1.0',
      provider: providerName,
      model: modelName,
      chunkCount: chunks.length,
      totalTokens,
    },
  };
};

module.exports = {
  JD_EXTRACTOR_VERSION,
  extractJdIntelligence,
};
