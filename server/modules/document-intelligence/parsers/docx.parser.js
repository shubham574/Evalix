const JSZip = require('jszip');
const AppError = require('../../common/errors/AppError');
const env = require('../../../config/env');
const { normalizeText, detectSectionHeading } = require('./text.normalizer');

const safeCodePoint = (num) =>
  Number.isInteger(num) && num >= 0 && num <= 0x10ffff ? String.fromCodePoint(num) : '';

const decodeXmlEntities = (str) =>
  (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeCodePoint(parseInt(hex, 16)));

const readZipEntryBoundedUtf8 = (docEntry, maxBytes) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;
    const stream = docEntry.nodeStream('nodebuffer');

    const fail = (err) => {
      if (settled) return;
      settled = true;
      stream.destroy();
      reject(err);
    };

    stream.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        fail(
          new AppError(
            400,
            'DOCX uncompressed XML exceeds safety limit',
            'ZIP_EXPANSION_LIMIT_EXCEEDED'
          )
        );
        return;
      }
      chunks.push(chunk);
    });

    stream.on('error', () => {
      fail(new AppError(400, 'Failed to decompress DOCX archive', 'CORRUPTED_DOCUMENT'));
    });

    stream.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, totalBytes).toString('utf8'));
    });
  });

const extractTextFromXmlRuns = (xmlFragment) => {
  const parts = [];
  const tokenRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
  let match;
  while ((match = tokenRegex.exec(xmlFragment)) !== null) {
    if (match[1] !== undefined) {
      parts.push(decodeXmlEntities(match[1]));
    } else if (match[0].startsWith('<w:tab')) {
      parts.push(' ');
    } else if (match[0].startsWith('<w:br')) {
      parts.push('\n');
    }
  }
  return normalizeText(parts.join(''));
};

/**
 * Parse a DOCX buffer securely:
 * - Guards against ZIP expansion / ZIP-bomb attacks via uncompressed size tracking
 * - Preserves paragraph indexes, headings, lists, and table rows
 * - Never executes macros or resolves external relationships
 */
const parseDocxBuffer = async ({
  documentId,
  documentType,
  buffer,
  maxCharacters = env.DOCUMENT_EXTRACTION_MAX_CHARACTERS,
  maxUncompressedBytes = env.DOCUMENT_EXTRACTION_MAX_DOCX_UNCOMPRESSED_BYTES,
}) => {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'DOCX document is empty', 'EMPTY_DOCUMENT');
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new AppError(400, 'Failed to parse DOCX archive: file may be corrupted', 'CORRUPTED_DOCUMENT');
  }

  const docEntry = zip.file('word/document.xml');
  if (!docEntry) {
    throw new AppError(400, 'Invalid DOCX archive: missing word/document.xml', 'CORRUPTED_DOCUMENT');
  }

  // ZIP-bomb / expansion guard: inspect uncompressed size metadata before/during decompression
  const declaredSize = docEntry._data?.uncompressedSize;
  if (typeof declaredSize === 'number' && declaredSize > maxUncompressedBytes) {
    throw new AppError(
      400,
      'DOCX uncompressed content exceeds safety limit',
      'ZIP_EXPANSION_LIMIT_EXCEEDED'
    );
  }

  const xmlContent = await readZipEntryBoundedUtf8(docEntry, maxUncompressedBytes);

  const bodyMatch = xmlContent.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  const bodyXml = bodyMatch ? bodyMatch[1] : xmlContent;

  const blocks = [];
  let paragraphIndex = 0;
  let currentHeading = null;
  let totalCharacters = 0;
  let truncated = false;

  // Match top-level paragraphs (<w:p>) and tables (<w:tbl>) in reading order
  const elementRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let elMatch;

  while ((elMatch = elementRegex.exec(bodyXml)) !== null) {
    const elXml = elMatch[0];

    if (elXml.startsWith('<w:tbl')) {
      const rows = [];
      const rowMatches = elXml.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g) || [];
      for (const rowXml of rowMatches) {
        const cells = [];
        const cellMatches = rowXml.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) || [];
        for (const cellXml of cellMatches) {
          const cellText = extractTextFromXmlRuns(cellXml);
          if (cellText) cells.push(cellText);
        }
        if (cells.length > 0) rows.push(cells.join(' | '));
      }
      const tableText = normalizeText(rows.join('\n'));
      if (!tableText) continue;

      if (totalCharacters + tableText.length > maxCharacters) {
        truncated = true;
        break;
      }

      blocks.push({
        blockId: `PARA_${paragraphIndex}`,
        blockType: 'TABLE',
        pageNumber: null,
        paragraphIndex,
        sectionHeading: currentHeading,
        text: tableText,
      });
      paragraphIndex += 1;
      totalCharacters += tableText.length;
    } else {
      const text = extractTextFromXmlRuns(elXml);
      if (!text) continue;

      const isHeadingStyle = /<w:pStyle\s+[^>]*w:val="(?:Heading\d*|Title|Subtitle)"/i.test(elXml);
      const isList = /<w:numPr\b/.test(elXml);
      const heuristicHeading = detectSectionHeading(text);

      let blockType = 'PARAGRAPH';
      if (isHeadingStyle || heuristicHeading) {
        blockType = 'HEADING';
        currentHeading = text.replace(/:$/, '');
      } else if (isList) {
        blockType = 'LIST_ITEM';
      }

      if (totalCharacters + text.length > maxCharacters) {
        const remaining = maxCharacters - totalCharacters;
        if (remaining > 0) {
          blocks.push({
            blockId: `PARA_${paragraphIndex}`,
            blockType,
            pageNumber: null,
            paragraphIndex,
            sectionHeading: currentHeading,
            text: text.slice(0, remaining),
          });
          totalCharacters += remaining;
        }
        truncated = true;
        break;
      }

      blocks.push({
        blockId: `PARA_${paragraphIndex}`,
        blockType,
        pageNumber: null,
        paragraphIndex,
        sectionHeading: currentHeading,
        text,
      });
      paragraphIndex += 1;
      totalCharacters += text.length;
    }
  }

  if (blocks.length === 0) {
    return {
      documentId: String(documentId),
      documentType,
      parser: 'docx',
      status: 'OCR_REQUIRED',
      reason: 'NO_EXTRACTABLE_TEXT',
      blocks: [],
      metadata: {
        pageCount: 0,
        emptyPageCount: 0,
        paragraphCount: 0,
        totalCharacters: 0,
        truncated: false,
      },
    };
  }

  return {
    documentId: String(documentId),
    documentType,
    parser: 'docx',
    status: 'PARSED',
    blocks,
    metadata: {
      pageCount: 0,
      emptyPageCount: 0,
      paragraphCount: blocks.length,
      totalCharacters,
      truncated,
    },
  };
};

module.exports = { parseDocxBuffer };
