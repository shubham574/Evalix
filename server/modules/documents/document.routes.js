const express = require('express');
const { protect } = require('../../middleware/auth');
const { validateObjectIdParam } = require('../common/validators/validate');
const documentController = require('./document.controller');

const router = express.Router();

router.use(protect);

router.get(
  '/:documentId/download-url',
  validateObjectIdParam('documentId'),
  documentController.getSignedDownloadUrl
);

router.get(
  '/:documentId/download',
  validateObjectIdParam('documentId'),
  documentController.downloadDocument
);

router.delete(
  '/:documentId',
  validateObjectIdParam('documentId'),
  documentController.deleteDocument
);

module.exports = router;
