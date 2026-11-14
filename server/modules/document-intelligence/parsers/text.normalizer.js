/**
 * Normalize extracted document text for consistent evidence matching and LLM consumption.
 * Preserves dates, meaningful line breaks, and section boundaries.
 */
const normalizeText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return '';

  return rawText
    .normalize('NFKC')
    // Remove control characters except newline and tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize dashes (en-dash / em-dash) to standard hyphen for date/range consistency
    .replace(/[\u2013\u2014]/g, '-')
    // Normalize CRLF -> LF
    .replace(/\r\n?/g, '\n')
    // Collapse horizontal spaces/tabs per line
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    // Collapse 3+ consecutive newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Normalize text for case-insensitive substring evidence matching.
 */
const normalizeForComparison = (text) => {
  return normalizeText(text)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Detect whether a short line looks like a section heading.
 */
const detectSectionHeading = (line) => {
  const trimmed = (line || '').trim();
  if (!trimmed || trimmed.length > 60) return null;
  const knownHeadings = /^(professional\s+summary|summary|profile|experience|work\s+experience|employment|skills|technical\s+skills|projects|education|certifications|achievements|leadership|responsibilities|requirements|qualifications|preferred\s+qualifications|about\s+the\s+role)$/i;
  if (knownHeadings.test(trimmed.replace(/:$/, ''))) {
    return trimmed.replace(/:$/, '');
  }
  return null;
};

module.exports = {
  normalizeText,
  normalizeForComparison,
  detectSectionHeading,
};
