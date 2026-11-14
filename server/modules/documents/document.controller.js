const asyncHandler = require('../../utils/asyncHandler');
const documentService = require('./document.service');

exports.getSignedDownloadUrl = asyncHandler(async (req, res) => {
  const data = await documentService.getSignedDownloadUrl({
    documentId: req.params.documentId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    message: 'Signed download URL generated successfully',
    data,
  });
});

exports.downloadDocument = asyncHandler(async (req, res) => {
  const { doc, stream } = await documentService.getDocumentStream({
    documentId: req.params.documentId,
    userId: req.auth.userId,
    expires: req.query.expires,
    sig: req.query.sig,
  });

  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${doc.originalFilename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  stream.pipe(res);
});

exports.deleteDocument = asyncHandler(async (req, res) => {
  const data = await documentService.deleteDocument({
    documentId: req.params.documentId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    message: 'Document deleted successfully',
    data,
  });
});
