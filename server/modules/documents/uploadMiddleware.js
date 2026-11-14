const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../../config/env');
const { getStorageAdapter } = require('./storage.adapter');
const AppError = require('../common/errors/AppError');

/**
 * Multer diskStorage middleware writing to a private temporary directory
 * so large documents are not buffered in RAM.
 */
const createDocumentUploadMiddleware = (fieldName) => {
  const storageAdapter = getStorageAdapter();

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      storageAdapter
        .ensureDirs()
        .then(() => cb(null, storageAdapter.tmpDir))
        .catch((err) => cb(err));
    },
    filename: (req, file, cb) => {
      const randomName = `${Date.now()}-${crypto.randomUUID()}.tmp`;
      cb(null, randomName);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: env.MAX_DOCUMENT_SIZE_BYTES,
      files: 1,
    },
  }).single(fieldName);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              400,
              `Document exceeds maximum allowed size of ${Math.round(env.MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024))}MB`,
              'FILE_TOO_LARGE'
            )
          );
        }
        return next(new AppError(400, err.message, 'UPLOAD_ERROR'));
      }
      return next(err);
    });
  };
};

/**
 * Safely remove a temporary upload file if it still exists.
 */
const cleanupTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fsp.unlink(path.resolve(filePath));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('Temp file cleanup warning:', err.code || err.message);
    }
  }
};

module.exports = {
  createDocumentUploadMiddleware,
  cleanupTempFile,
};
