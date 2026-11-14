const AppError = require('../../common/errors/AppError');
const { parsePdfBuffer } = require('./pdf.parser');
const { parseDocxBuffer } = require('./docx.parser');
const { normalizeText, detectSectionHeading } = require('./text.normalizer');

const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Parse a binary document (PDF or DOCX) into the canonical ParsedDocument representation.
 */
const parseDocument = async ({
  documentId,
  documentType,
  mimeType,
  buffer,
  maxPages,
  maxCharacters,
  timeoutMs,
}) => {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'Uploaded document is empty', 'EMPTY_DOCUMENT');
  }

  if (mimeType === MIME_PDF) {
    return parsePdfBuffer({
      documentId,
      documentType,
      buffer,
      maxPages,
      maxCharacters,
      timeoutMs,
    });
  }

  if (mimeType === MIME_DOCX) {
    return parseDocxBuffer({
      documentId,
      documentType,
      buffer,
      maxCharacters,
    });
  }

  throw new AppError(
    400,
    `Unsupported document MIME type: ${mimeType}`,
    'UNSUPPORTED_DOCUMENT_TYPE'
  );
};

/**
 * Convert plain-text job description into the same canonical ParsedDocument representation
 * so JD extraction and evidence validation work identically for both text and uploaded files.
 */
const parsePlainTextDocument = ({ documentId, documentType = 'JOB_DESCRIPTION', text }) => {
  const clean = normalizeText(text);
  if (!clean) {
    throw new AppError(400, 'Job description text is empty', 'EMPTY_DOCUMENT');
  }

  const paragraphs = clean.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  let currentHeading = null;
  const blocks = paragraphs.map((p, idx) => {
    const trimmed = p.trim();
    const heading = detectSectionHeading(trimmed);
    if (heading) currentHeading = heading;
    return {
      blockId: `TEXT_BLOCK_${idx}`,
      blockType: heading ? 'HEADING' : 'TEXT',
      pageNumber: null,
      paragraphIndex: idx,
      sectionHeading: currentHeading,
      text: trimmed,
    };
  });

  return {
    documentId: String(documentId),
    documentType,
    parser: 'text',
    status: 'PARSED',
    blocks,
    metadata: {
      pageCount: 0,
      emptyPageCount: 0,
      paragraphCount: blocks.length,
      totalCharacters: clean.length,
      truncated: false,
    },
  };
};

module.exports = {
  parseDocument,
  parsePlainTextDocument,
};
