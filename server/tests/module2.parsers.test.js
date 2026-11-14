const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const { parseDocument } = require('../modules/document-intelligence/parsers/parser.factory');
const { normalizeText } = require('../modules/document-intelligence/parsers/text.normalizer');

const REAL_PDF_PATH = path.join(
  __dirname,
  '..',
  'node_modules',
  'pdf-parse',
  'test',
  'data',
  '04-valid.pdf'
);

// Helper: build a minimal valid single-page image-only/empty-text PDF buffer
function buildEmptyTextPdf() {
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n';
  let pdf = '%PDF-1.4\n';
  const o1 = Buffer.byteLength(pdf, 'utf8');
  pdf += obj1;
  const o2 = Buffer.byteLength(pdf, 'utf8');
  pdf += obj2;
  const o3 = Buffer.byteLength(pdf, 'utf8');
  pdf += obj3;
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 4\n0000000000 65535 f \n${String(o1).padStart(10, '0')} 00000 n \n${String(o2).padStart(10, '0')} 00000 n \n${String(o3).padStart(10, '0')} 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

// Helper: build a real DOCX buffer using JSZip
async function buildTestDocx({ paragraphs = [], tables = [] } = {}) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );

  const pXml = paragraphs
    .map((p) => {
      const styleXml = p.heading ? `<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>` : '';
      const listXml = p.list ? `<w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr>` : '';
      return `<w:p>${styleXml || listXml}<w:r><w:t>${p.text}</w:t></w:r></w:p>`;
    })
    .join('');

  const tblXml = tables
    .map(
      (rows) =>
        `<w:tbl>${rows
          .map(
            (row) =>
              `<w:tr>${row
                .map((cell) => `<w:tc><w:p><w:r><w:t>${cell}</w:t></w:r></w:p></w:tc>`)
                .join('')}</w:tr>`
          )
          .join('')}</w:tbl>`
    )
    .join('');

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${pXml}${tblXml}</w:body></w:document>`
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('Module 2: Document Parsers & Normalizer (TDD)', () => {
  it('1, 3. Parses a valid multi-page PDF preserving page numbers and blocks', async () => {
    const buf = fs.readFileSync(REAL_PDF_PATH);
    const result = await parseDocument({
      documentId: 'DOC_1',
      documentType: 'RESUME',
      mimeType: 'application/pdf',
      buffer: buf,
    });

    assert.strictEqual(result.status, 'PARSED');
    assert.strictEqual(result.parser, 'pdf');
    assert.ok(result.metadata.pageCount >= 2);
    assert.ok(result.blocks.length >= 2);
    assert.ok(result.blocks.some((b) => b.pageNumber === 1));
    assert.ok(result.blocks.some((b) => b.pageNumber === 2));
  });

  it('2, 4, 5, 13. Parses valid DOCX with headings, lists, tables, and Unicode', async () => {
    const buf = await buildTestDocx({
      paragraphs: [
        { text: 'Experience', heading: true },
        { text: 'Built scalable APIs in Node.js — café résumé naïve 🚀', list: true },
      ],
      tables: [[['Skill', 'Level'], ['MongoDB', 'Advanced']]],
    });

    const result = await parseDocument({
      documentId: 'DOC_2',
      documentType: 'RESUME',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: buf,
    });

    assert.strictEqual(result.status, 'PARSED');
    assert.strictEqual(result.parser, 'docx');
    assert.ok(result.blocks.some((b) => b.blockType === 'HEADING' && b.text === 'Experience'));
    assert.ok(result.blocks.some((b) => b.blockType === 'LIST_ITEM' && b.sectionHeading === 'Experience'));
    assert.ok(result.blocks.some((b) => b.blockType === 'TABLE' && b.text.includes('MongoDB')));
    assert.ok(result.blocks.some((b) => b.text.includes('café résumé')));
    assert.ok(result.blocks.every((b) => typeof b.paragraphIndex === 'number'));
  });

  it('6. Rejects corrupted PDF with CORRUPTED_DOCUMENT', async () => {
    await assert.rejects(
      () =>
        parseDocument({
          documentId: 'DOC_BAD_PDF',
          documentType: 'RESUME',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\ncorrupted-binary-garbage'),
        }),
      (err) => err.code === 'CORRUPTED_DOCUMENT'
    );
  });

  it('7. Rejects corrupted DOCX with CORRUPTED_DOCUMENT', async () => {
    await assert.rejects(
      () =>
        parseDocument({
          documentId: 'DOC_BAD_DOCX',
          documentType: 'RESUME',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: Buffer.from('PK\x03\x04not-a-valid-zip'),
        }),
      (err) => err.code === 'CORRUPTED_DOCUMENT'
    );
  });

  it('8. Rejects empty document', async () => {
    await assert.rejects(
      () =>
        parseDocument({
          documentId: 'DOC_EMPTY',
          documentType: 'RESUME',
          mimeType: 'application/pdf',
          buffer: Buffer.alloc(0),
        }),
      (err) => err.code === 'EMPTY_DOCUMENT'
    );
  });

  it('9. Detects image-only / scanned PDF with no extractable text and returns OCR_REQUIRED', async () => {
    const { parsePdfBuffer } = require('../modules/document-intelligence/parsers/pdf.parser');
    const result = await parsePdfBuffer({
      documentId: 'DOC_SCAN',
      documentType: 'RESUME',
      buffer: Buffer.from('%PDF-1.4\n%%EOF'),
      pdfParseFn: async (_buf, opts) => {
        await opts.pagerender({ getTextContent: async () => ({ items: [] }) });
        return { numpages: 1, text: '' };
      },
    });

    assert.strictEqual(result.status, 'OCR_REQUIRED');
    assert.strictEqual(result.reason, 'NO_EXTRACTABLE_TEXT');
  });

  it('10. Detects encrypted PDF and rejects with ENCRYPTED_DOCUMENT', async () => {
    const encryptedLikePdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Encrypt 5 0 R >>\nendobj\n%%EOF');
    await assert.rejects(
      () =>
        parseDocument({
          documentId: 'DOC_ENC',
          documentType: 'RESUME',
          mimeType: 'application/pdf',
          buffer: encryptedLikePdf,
        }),
      (err) => err.code === 'ENCRYPTED_DOCUMENT' || err.code === 'CORRUPTED_DOCUMENT'
    );
  });

  it('11. Enforces maxPages limit on PDF', async () => {
    const buf = fs.readFileSync(REAL_PDF_PATH);
    await assert.rejects(
      () =>
        parseDocument({
          documentId: 'DOC_PAGES',
          documentType: 'RESUME',
          mimeType: 'application/pdf',
          buffer: buf,
          maxPages: 1,
        }),
      (err) => err.code === 'DOCUMENT_PAGE_LIMIT_EXCEEDED'
    );
  });

  it('12. Rejects unsupported MIME type', async () => {
    await assert.rejects(
      () =>
        parseDocument({
          documentId: 'DOC_UNSUP',
          documentType: 'RESUME',
          mimeType: 'application/x-msdownload',
          buffer: Buffer.from('MZ'),
        }),
      (err) => err.code === 'UNSUPPORTED_DOCUMENT_TYPE'
    );
  });

  it('Normalizes Unicode, whitespace, and control characters without destroying dates', () => {
    const raw = '  Senior\u0000   Engineer\r\n\r\n\r\nJanuary 2023 – Present  ';
    const clean = normalizeText(raw);
    assert.strictEqual(clean, 'Senior Engineer\n\nJanuary 2023 - Present');
  });

  it('Security: Aborts DOCX decompression mid-stream on ZIP expansion limit and safely handles out-of-range XML entities', async () => {
    const { parseDocxBuffer } = require('../modules/document-intelligence/parsers/docx.parser');
    const makeDocx = async (bodyXml) => {
      const zip = new JSZip();
      zip.file(
        'word/document.xml',
        `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`
      );
      return zip.generateAsync({ type: 'nodebuffer' });
    };

    const bigBody = `<w:p><w:r><w:t>${'A'.repeat(2000)}</w:t></w:r></w:p>`;
    const zipBuf = await makeDocx(bigBody);
    await assert.rejects(
      () =>
        parseDocxBuffer({
          documentId: 'DOC_ZIPBOMB',
          documentType: 'RESUME',
          buffer: zipBuf,
          maxUncompressedBytes: 512,
        }),
      (err) => err.code === 'ZIP_EXPANSION_LIMIT_EXCEEDED'
    );

    const weirdEntityBuf = await makeDocx('<w:p><w:r><w:t>Hello &#99999999; World</w:t></w:r></w:p>');
    const parsed = await parseDocxBuffer({
      documentId: 'DOC_ENTITY',
      documentType: 'RESUME',
      buffer: weirdEntityBuf,
    });
    assert.strictEqual(parsed.blocks[0].text, 'Hello World');
  });
});
