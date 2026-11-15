const crypto = require('crypto');
const env = require('../../config/env');
const AppError = require('../common/errors/AppError');
const { getStorageAdapter } = require('./storage.adapter');
const { validateUploadedDocument } = require('./document.validation');
const { scanDocument } = require('./malware-scanner');
const { cleanupTempFile } = require('./uploadMiddleware');
const documentRepo = require('./document.repository');

/**
 * Strip internal storage paths/keys from API responses.
 */
const toPublicDocumentDTO = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    candidateProfileId: String(obj.candidateProfileId),
    documentType: obj.documentType,
    originalFilename: obj.originalFilename,
    mimeType: obj.mimeType,
    fileSize: obj.fileSize,
    checksum: obj.checksum,
    uploadStatus: obj.uploadStatus,
    processingStatus: obj.processingStatus,
    securityStatus: obj.securityStatus,
    retentionExpiresAt: obj.retentionExpiresAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

/**
 * Validate, deduplicate, store privately, and persist document metadata.
 * Ensures storage cleanup if DB persistence fails, and temp cleanup on any failure.
 */
const storeCandidateDocument = async ({
  candidateProfileId,
  userId,
  documentType,
  file,
  session = null,
}) => {
  if (!file) {
    throw new AppError(400, `No ${documentType.toLowerCase()} file uploaded`, 'DOCUMENT_REQUIRED');
  }

  const storageAdapter = getStorageAdapter();
  let storedKey = null;

  try {
    const { sanitizedName, ext, checksum } = await validateUploadedDocument({
      filePath: file.path,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      maxSizeBytes: env.MAX_DOCUMENT_SIZE_BYTES,
    });

    // Malware scan (rejects with 422 MALWARE_DETECTED / 503 fail-closed before anything is stored)
    let securityStatus = 'SIGNATURE_VERIFIED_NO_AV';
    if (env.MALWARE_SCAN_ENABLED) {
      await scanDocument({ filePath: file.path, ext });
      securityStatus = 'MALWARE_SCANNED_CLEAN';
    }

    // Idempotent retry check: if identical file was already uploaded for this candidate & type, reuse it
    const existing = await documentRepo.findByChecksum(
      { candidateProfileId, documentType, checksum },
      session
    );
    if (existing) {
      // The record may outlive its file on ephemeral disks (redeploy/restart). If the bytes are
      // gone, restore them from this (identical, freshly scanned) upload instead of reusing a dangling record.
      if (!(await storageAdapter.exists(existing.storageKey))) {
        await storageAdapter.putFromTempFile(file.path, existing.storageKey);
      } else {
        await cleanupTempFile(file.path);
      }
      if (
        securityStatus === 'MALWARE_SCANNED_CLEAN' &&
        existing.securityStatus !== 'MALWARE_SCANNED_CLEAN' &&
        existing.securityStatus !== 'QUARANTINED'
      ) {
        // Same bytes, now verified clean: upgrade the earlier unscanned record.
        const upgraded = await documentRepo.markSecurityStatus(existing._id, securityStatus, session);
        return { document: upgraded || existing, deduplicated: true };
      }
      return { document: existing, deduplicated: true };
    }

    const storedFilename = `${crypto.randomUUID()}${ext}`;
    const storageKey = `${String(candidateProfileId)}/${documentType.toLowerCase()}/${storedFilename}`;

    await storageAdapter.putFromTempFile(file.path, storageKey);
    storedKey = storageKey;

    const retentionExpiresAt = new Date(
      Date.now() + env.DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    const doc = await documentRepo.createDocument(
      {
        candidateProfileId,
        userId,
        documentType,
        originalFilename: sanitizedName,
        storedFilename,
        mimeType: file.mimetype,
        fileSize: file.size,
        storageProvider: storageAdapter.provider,
        storageKey,
        checksum,
        uploadStatus: 'VALIDATED',
        processingStatus: 'PENDING_ANALYSIS',
        securityStatus,
        retentionExpiresAt,
      },
      session
    );

    return { document: doc, deduplicated: false };
  } catch (err) {
    // Transactional storage cleanup if DB persistence or later step failed after moving file
    if (storedKey) {
      await storageAdapter.deleteObject(storedKey);
    }
    await cleanupTempFile(file.path);
    throw err;
  }
};

/**
 * Generate a short-lived signed download URL for an owned document.
 */
const getSignedDownloadUrl = async ({ documentId, userId }) => {
  const doc = await documentRepo.findByIdAndUser(documentId, userId);
  if (!doc) {
    throw new AppError(404, 'Document not found', 'DOCUMENT_NOT_FOUND');
  }
  const storageAdapter = getStorageAdapter();
  const { expires, sig } = storageAdapter.createSignedDownloadParams({
    documentId: String(doc._id),
    userId,
  });

  return {
    documentId: String(doc._id),
    downloadUrl: `/api/v1/documents/${doc._id}/download?expires=${expires}&sig=${sig}`,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
};

/**
 * Stream a document after verifying ownership and optional signed parameters.
 */
const getDocumentStream = async ({ documentId, userId, expires, sig }) => {
  const doc = await documentRepo.findByIdAndUser(documentId, userId);
  if (!doc) {
    throw new AppError(404, 'Document not found', 'DOCUMENT_NOT_FOUND');
  }

  const storageAdapter = getStorageAdapter();
  if (expires !== undefined || sig !== undefined) {
    const valid = storageAdapter.verifySignedDownloadParams({
      documentId: String(doc._id),
      userId,
      expires,
      sig,
    });
    if (!valid) {
      throw new AppError(403, 'Signed download link is invalid or expired', 'INVALID_SIGNED_URL');
    }
  }

  const stream = await storageAdapter.getReadStream(doc.storageKey);
  return { doc, stream };
};

/**
 * Soft-delete document record and remove underlying private object.
 */
const deleteDocument = async ({ documentId, userId }) => {
  const doc = await documentRepo.findByIdAndUser(documentId, userId);
  if (!doc) {
    throw new AppError(404, 'Document not found', 'DOCUMENT_NOT_FOUND');
  }
  await documentRepo.markDeleted(documentId, userId);
  await getStorageAdapter().deleteObject(doc.storageKey);
  return { deleted: true, documentId: String(doc._id) };
};

module.exports = {
  toPublicDocumentDTO,
  storeCandidateDocument,
  getSignedDownloadUrl,
  getDocumentStream,
  deleteDocument,
};
