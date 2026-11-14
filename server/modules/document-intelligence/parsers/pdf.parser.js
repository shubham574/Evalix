const pdfParse = require('pdf-parse');
const AppError = require('../../common/errors/AppError');
const env = require('../../../config/env');
const { normalizeText, detectSectionHeading } = require('./text.normalizer');

/**
 * Parse a PDF buffer page-by-page using pdf-parse, enforcing page limits,
 * character limits, timeout, encryption detection, and scanned-PDF detection.
 */
const parsePdfBuffer = async ({
  documentId,
  documentType,
  buffer,
  maxPages = env.DOCUMENT_EXTRACTION_MAX_PAGES,
  maxCharacters = env.DOCUMENT_EXTRACTION_MAX_CHARACTERS,
  timeoutMs = env.DOCUMENT_EXTRACTION_TIMEOUT_MS,
  pdfParseFn = pdfParse,
}) => {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'PDF document is empty', 'EMPTY_DOCUMENT');
  }

  // Quick encryption check on PDF trailer/header before full parse
  const headerSlice = buffer.subarray(0, Math.min(buffer.length, 65536)).toString('latin1');
  if (!headerSlice.startsWith('%PDF-')) {
    throw new AppError(400, 'Invalid PDF file signature', 'CORRUPTED_DOCUMENT');
  }
  if (/\/Encrypt\b/.test(headerSlice)) {
    throw new AppError(400, 'Encrypted or password-protected PDFs are not supported', 'ENCRYPTED_DOCUMENT');
  }

  const pages = [];

  const pagerender = async (pageData) => {
    const textContent = await pageData.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    });
    let lastY;
    let pageText = '';
    for (const item of textContent.items) {
      if (lastY === item.transform[5] || lastY === undefined) {
        pageText += item.str;
      } else {
        pageText += '\n' + item.str;
      }
      lastY = item.transform[5];
    }
    pages.push({ pageNumber: pages.length + 1, rawText: pageText });
    return pageText;
  };

  let parsed;
  let timeoutId;
  try {
    const parsePromise = pdfParseFn(buffer, { pagerender, max: maxPages + 1 });
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new AppError(408, 'PDF parsing timed out', 'PARSE_TIMEOUT')),
        timeoutMs
      );
    });
    parsed = await Promise.race([parsePromise, timeoutPromise]);
  } catch (err) {
    if (err instanceof AppError) throw err;
    const msg = (err?.message || '').toLowerCase();
    console.warn('PDF parse failure:', err?.message);
    if (msg.includes('password') || msg.includes('encrypt')) {
      throw new AppError(400, 'Encrypted PDF is not supported', 'ENCRYPTED_DOCUMENT');
    }
    throw new AppError(400, 'Failed to parse PDF document: file may be corrupted', 'CORRUPTED_DOCUMENT');
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const totalPages = parsed?.numpages || pages.length;
  if (totalPages > maxPages) {
    throw new AppError(
      400,
      `PDF exceeds maximum allowed page limit (${maxPages})`,
      'DOCUMENT_PAGE_LIMIT_EXCEEDED'
    );
  }

  const blocks = [];
  let emptyPageCount = 0;
  let totalCharacters = 0;
  let truncated = false;
  let currentHeading = null;

  for (const page of pages) {
    const cleanPageText = normalizeText(page.rawText);
    if (!cleanPageText) {
      emptyPageCount += 1;
      continue;
    }

    const paragraphs = cleanPageText.split(/\n{2,}/).filter((p) => p.trim().length > 0);
    let blockIndexOnPage = 1;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      const heading = detectSectionHeading(trimmed);
      if (heading) {
        currentHeading = heading;
      }

      if (totalCharacters + trimmed.length > maxCharacters) {
        const remaining = maxCharacters - totalCharacters;
        if (remaining > 0) {
          blocks.push({
            blockId: `PAGE_${page.pageNumber}_BLOCK_${blockIndexOnPage++}`,
            blockType: heading ? 'HEADING' : 'PARAGRAPH',
            pageNumber: page.pageNumber,
            paragraphIndex: null,
            sectionHeading: currentHeading,
            text: trimmed.slice(0, remaining),
          });
          totalCharacters += remaining;
        }
        truncated = true;
        break;
      }

      blocks.push({
        blockId: `PAGE_${page.pageNumber}_BLOCK_${blockIndexOnPage++}`,
        blockType: heading ? 'HEADING' : 'PARAGRAPH',
        pageNumber: page.pageNumber,
        paragraphIndex: null,
        sectionHeading: currentHeading,
        text: trimmed,
      });
      totalCharacters += trimmed.length;
    }

    if (truncated) break;
  }

  if (blocks.length === 0 || totalCharacters < 5) {
    return {
      documentId: String(documentId),
      documentType,
      parser: 'pdf',
      status: 'OCR_REQUIRED',
      reason: 'NO_EXTRACTABLE_TEXT',
      blocks: [],
      metadata: {
        pageCount: totalPages,
        emptyPageCount: totalPages,
        paragraphCount: 0,
        totalCharacters: 0,
        truncated: false,
      },
    };
  }

  return {
    documentId: String(documentId),
    documentType,
    parser: 'pdf',
    status: 'PARSED',
    blocks,
    metadata: {
      pageCount: totalPages,
      emptyPageCount,
      paragraphCount: blocks.length,
      totalCharacters,
      truncated,
    },
  };
};

module.exports = { parsePdfBuffer };
