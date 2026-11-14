const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const AppError = require('../common/errors/AppError');

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// PDF signature: "%PDF-"
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
// ZIP (DOCX) signature: "PK\x03\x04"
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Sanitize an original filename for safe metadata display (never used as storage path).
 */
const sanitizeDisplayFilename = (rawName) => {
  const base = path.basename(String(rawName || 'document'));
  const cleaned = base
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'document').slice(0, 200);
};

/**
 * Compute SHA-256 checksum of a file on disk using streams.
 */
const computeFileChecksum = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

/**
 * Read a small prefix/slice of a file without loading large files into memory.
 */
const readFileSlice = async (filePath, offset, length) => {
  const fh = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, offset);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
};

/**
 * Validate uploaded document (extension, MIME, non-empty, size, and magic-byte signature).
 * Also checks DOCX ZIP central directory / structure markers to reject spoofed or malformed files.
 */
const validateUploadedDocument = async ({ filePath, originalname, mimetype, size, maxSizeBytes }) => {
  if (!filePath || size === 0) {
    throw new AppError(400, 'Uploaded document is empty', 'EMPTY_DOCUMENT');
  }

  if (size > maxSizeBytes) {
    throw new AppError(
      400,
      `Document exceeds maximum allowed size of ${Math.round(maxSizeBytes / (1024 * 1024))}MB`,
      'FILE_TOO_LARGE'
    );
  }

  const sanitizedName = sanitizeDisplayFilename(originalname);
  const ext = path.extname(sanitizedName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new AppError(
      400,
      'Invalid file extension. Only PDF and DOCX documents are supported.',
      'INVALID_DOCUMENT_FORMAT'
    );
  }

  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    throw new AppError(
      400,
      'Invalid MIME type. Only PDF and DOCX documents are supported.',
      'INVALID_DOCUMENT_FORMAT'
    );
  }

  // Verify actual binary magic bytes from disk
  const header = await readFileSlice(filePath, 0, 512);
  if (ext === '.pdf') {
    if (header.length < PDF_MAGIC.length || !header.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      throw new AppError(400, 'File signature does not match a valid PDF document', 'INVALID_DOCUMENT_SIGNATURE');
    }
    if (mimetype !== 'application/pdf') {
      throw new AppError(400, 'PDF extension does not match MIME type', 'INVALID_DOCUMENT_FORMAT');
    }
  } else if (ext === '.docx') {
    if (header.length < ZIP_MAGIC.length || !header.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
      throw new AppError(400, 'File signature does not match a valid DOCX archive', 'INVALID_DOCUMENT_SIGNATURE');
    }
    if (mimetype !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      throw new AppError(400, 'DOCX extension does not match MIME type', 'INVALID_DOCUMENT_FORMAT');
    }

    // Verify ZIP contains DOCX markers ([Content_Types].xml or word/) in header/tail without full extraction
    const tailOffset = Math.max(0, size - 65536);
    const tail = await readFileSlice(filePath, tailOffset, Math.min(65536, size));
    const combinedMarkers = Buffer.concat([header, tail]).toString('latin1');
    if (!combinedMarkers.includes('[Content_Types].xml') && !combinedMarkers.includes('word/')) {
      throw new AppError(
        400,
        'Uploaded ZIP archive is not a valid DOCX document',
        'INVALID_DOCUMENT_SIGNATURE'
      );
    }
  }

  const checksum = await computeFileChecksum(filePath);

  return {
    sanitizedName,
    ext,
    checksum,
  };
};

module.exports = {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  sanitizeDisplayFilename,
  computeFileChecksum,
  validateUploadedDocument,
};
