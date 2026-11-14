const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const AppError = require('../common/errors/AppError');
const env = require('../../config/env');

/**
 * Storage adapter interface for private candidate documents.
 * Supports local private filesystem storage and can be extended for S3/GCS/Azure.
 */
class LocalPrivateStorageAdapter {
  constructor(baseDir = env.DOCUMENT_STORAGE_PATH) {
    this.provider = 'local';
    this.baseDir = path.resolve(baseDir);
    this.tmpDir = path.join(this.baseDir, '.tmp');
  }

  async ensureDirs() {
    await fsp.mkdir(this.baseDir, { recursive: true });
    await fsp.mkdir(this.tmpDir, { recursive: true });
  }

  /**
   * Resolve a storageKey safely, preventing path traversal.
   */
  resolveSafePath(storageKey) {
    if (!storageKey || typeof storageKey !== 'string' || storageKey.includes('\0')) {
      throw new AppError(400, 'Invalid storage key', 'INVALID_STORAGE_KEY');
    }
    const normalizedKey = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
    const resolved = path.resolve(this.baseDir, normalizedKey);
    if (!resolved.startsWith(this.baseDir + path.sep)) {
      throw new AppError(400, 'Path traversal attempt blocked', 'INVALID_STORAGE_KEY');
    }
    return resolved;
  }

  /**
   * Move a validated temporary file into private storage using streams/rename.
   * @param {string} tempFilePath
   * @param {string} storageKey
   */
  async putFromTempFile(tempFilePath, storageKey) {
    await this.ensureDirs();
    const targetPath = this.resolveSafePath(storageKey);
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });

    try {
      await fsp.rename(tempFilePath, targetPath);
    } catch (err) {
      // Cross-device fallback using streams
      if (err.code === 'EXDEV') {
        await new Promise((resolve, reject) => {
          const rs = fs.createReadStream(tempFilePath);
          const ws = fs.createWriteStream(targetPath, { flags: 'wx' });
          rs.on('error', reject);
          ws.on('error', reject);
          ws.on('finish', resolve);
          rs.pipe(ws);
        });
        await fsp.unlink(tempFilePath).catch(() => {});
      } else {
        throw err;
      }
    }

    return { provider: this.provider, storageKey };
  }

  /**
   * Open a readable stream for an existing stored document.
   */
  async getReadStream(storageKey) {
    const targetPath = this.resolveSafePath(storageKey);
    try {
      await fsp.access(targetPath, fs.constants.R_OK);
    } catch {
      throw new AppError(404, 'Stored document file not found', 'DOCUMENT_FILE_MISSING');
    }
    return fs.createReadStream(targetPath);
  }

  /**
   * Delete a stored file (idempotent).
   */
  async deleteObject(storageKey) {
    try {
      const targetPath = this.resolveSafePath(storageKey);
      await fsp.unlink(targetPath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Log silently without leaking sensitive paths
        console.warn('Storage delete warning:', err.code || err.message);
      }
    }
  }

  /**
   * Generate a short-lived HMAC-signed download token for authenticated retrieval.
   */
  createSignedDownloadParams({ documentId, userId, ttlSeconds = env.DOCUMENT_SIGNED_URL_TTL_SECONDS }) {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = `${documentId}:${userId}:${expires}`;
    const sig = crypto
      .createHmac('sha256', env.DOCUMENT_SIGNING_SECRET)
      .update(payload)
      .digest('hex');
    return { expires, sig };
  }

  /**
   * Verify a short-lived HMAC-signed download token.
   */
  verifySignedDownloadParams({ documentId, userId, expires, sig }) {
    const expNum = Number(expires);
    if (!expNum || !sig || expNum < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const payload = `${documentId}:${userId}:${expNum}`;
    const expected = crypto
      .createHmac('sha256', env.DOCUMENT_SIGNING_SECRET)
      .update(payload)
      .digest('hex');
    const sigBuf = Buffer.from(String(sig));
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }
}

const getStorageAdapter = () => {
  // Future: switch on env.DOCUMENT_STORAGE_PROVIDER === 's3'
  return new LocalPrivateStorageAdapter(env.DOCUMENT_STORAGE_PATH);
};

module.exports = {
  LocalPrivateStorageAdapter,
  getStorageAdapter,
};
