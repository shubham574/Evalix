const { normalizeForComparison } = require('../parsers/text.normalizer');

/**
 * Validate a single EvidenceItem against the parsed document blocks.
 */
const validateSingleEvidence = (item, parsedDoc, blockById, fieldPath) => {
  const warnings = [];
  const docId = String(parsedDoc.documentId);

  if (!item || typeof item !== 'object') {
    return { item, warnings: [`${fieldPath}: invalid evidence object`] };
  }

  if (String(item.documentId) !== docId) {
    warnings.push(`${fieldPath}: documentId mismatch (expected ${docId})`);
    return {
      item: { ...item, verificationStatus: 'UNVERIFIED' },
      warnings,
    };
  }

  const block = blockById.get(item.blockId);
  if (!block) {
    warnings.push(`${fieldPath}: blockId "${item.blockId}" not found in parsed document`);
    return {
      item: { ...item, verificationStatus: 'UNVERIFIED' },
      warnings,
    };
  }

  if (parsedDoc.parser === 'pdf' && item.pageNumber !== null && item.pageNumber !== block.pageNumber) {
    warnings.push(
      `${fieldPath}: pageNumber mismatch (claimed ${item.pageNumber}, actual ${block.pageNumber})`
    );
    return {
      item: { ...item, verificationStatus: 'UNVERIFIED' },
      warnings,
    };
  }

  if (
    parsedDoc.parser === 'docx' &&
    item.paragraphIndex !== null &&
    item.paragraphIndex !== block.paragraphIndex
  ) {
    warnings.push(
      `${fieldPath}: paragraphIndex mismatch (claimed ${item.paragraphIndex}, actual ${block.paragraphIndex})`
    );
    return {
      item: { ...item, verificationStatus: 'UNVERIFIED' },
      warnings,
    };
  }

  const normQuote = normalizeForComparison(item.quote);
  const normBlockText = normalizeForComparison(block.text);

  if (!normQuote || !normBlockText.includes(normQuote)) {
    warnings.push(`${fieldPath}: quote mismatch against source block ${item.blockId}`);
    return {
      item: { ...item, verificationStatus: 'UNVERIFIED' },
      warnings,
    };
  }

  return {
    item: {
      ...item,
      pageNumber: block.pageNumber,
      paragraphIndex: block.paragraphIndex,
      sectionHeading: item.sectionHeading || block.sectionHeading || null,
      verificationStatus: item.verificationStatus === 'DERIVED' ? 'DERIVED' : 'EXPLICIT',
    },
    warnings,
  };
};

/**
 * Recursively walk an extraction object, validating all `evidence` arrays
 * and flagging factual fields that lack supporting evidence.
 */
const validateExtractionEvidence = (extraction, parsedDoc) => {
  const blockById = new Map((parsedDoc.blocks || []).map((b) => [b.blockId, b]));
  const warnings = Array.isArray(extraction.validationWarnings)
    ? [...extraction.validationWarnings]
    : [];

  const walk = (node, pathStr) => {
    if (Array.isArray(node)) {
      return node.map((el, idx) => walk(el, `${pathStr}[${idx}]`));
    }
    if (!node || typeof node !== 'object') {
      return node;
    }

    const out = {};
    for (const [key, val] of Object.entries(node)) {
      if (key === 'evidence' && Array.isArray(val)) {
        // Check if sibling value/text/name is non-null & non-empty but evidence is empty
        const hasFactualValue =
          (typeof node.value === 'string' && node.value.trim().length > 0) ||
          (typeof node.value === 'number' && !Number.isNaN(node.value)) ||
          (typeof node.text === 'string' && node.text.trim().length > 0) ||
          (typeof node.name === 'string' && node.name.trim().length > 0);

        if (val.length === 0 && hasFactualValue && node.classification !== 'INFERRED') {
          warnings.push(`${pathStr}: Missing supporting evidence for extracted claim`);
          out[key] = [];
        } else {
          out[key] = val.map((ev) => {
            const res = validateSingleEvidence(ev, parsedDoc, blockById, pathStr);
            warnings.push(...res.warnings);
            return res.item;
          });
        }
      } else if (key === 'validationWarnings') {
        out[key] = val;
      } else {
        out[key] = walk(val, pathStr ? `${pathStr}.${key}` : key);
      }
    }
    return out;
  };

  const validated = walk(extraction, '');
  validated.validationWarnings = [...new Set(warnings)];
  return { validated, warnings: validated.validationWarnings };
};

module.exports = {
  validateSingleEvidence,
  validateExtractionEvidence,
};
