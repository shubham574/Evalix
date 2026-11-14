const crypto = require('crypto');

const buildEvidenceId = (item, fallbackPrefix = 'EVD') => {
  const key = [
    item?.documentId || '',
    item?.blockId || '',
    item?.pageNumber ?? '',
    item?.paragraphIndex ?? '',
    item?.quote || '',
  ].join('|');
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
  return `${fallbackPrefix}_${hash}`;
};

/**
 * Index Module 2 evidence items into a deterministic lookup table keyed by evidenceId.
 */
const indexEvidenceItems = (evidenceItems = [], expectedDocumentId = null) => {
  const byId = new Map();
  const list = [];

  for (const item of evidenceItems || []) {
    if (!item || typeof item !== 'object') continue;
    if (expectedDocumentId && item.documentId && String(item.documentId) !== String(expectedDocumentId)) {
      continue;
    }
    const evidenceId = buildEvidenceId(item);
    if (!byId.has(evidenceId)) {
      const normalized = {
        evidenceId,
        documentId: item.documentId ? String(item.documentId) : expectedDocumentId ? String(expectedDocumentId) : null,
        blockId: item.blockId || null,
        pageNumber: item.pageNumber ?? null,
        paragraphIndex: item.paragraphIndex ?? null,
        quote: item.quote || '',
        matchConfidence: item.matchConfidence || 'UNVERIFIED',
      };
      byId.set(evidenceId, normalized);
      list.push(normalized);
    }
  }

  return { byId, list };
};

const registerFactEvidence = (evidenceRegistry, items = [], expectedDocumentId = null) => {
  const ids = [];
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    if (expectedDocumentId && item.documentId && String(item.documentId) !== String(expectedDocumentId)) {
      continue;
    }
    const evidenceId = buildEvidenceId(item);
    if (!evidenceRegistry.has(evidenceId)) {
      evidenceRegistry.set(evidenceId, {
        evidenceId,
        documentId: item.documentId ? String(item.documentId) : expectedDocumentId ? String(expectedDocumentId) : null,
        blockId: item.blockId || null,
        pageNumber: item.pageNumber ?? null,
        paragraphIndex: item.paragraphIndex ?? null,
        quote: item.quote || '',
        matchConfidence: item.matchConfidence || 'UNVERIFIED',
      });
    }
    ids.push(evidenceId);
  }
  return [...new Set(ids)];
};

module.exports = {
  buildEvidenceId,
  indexEvidenceItems,
  registerFactEvidence,
};
