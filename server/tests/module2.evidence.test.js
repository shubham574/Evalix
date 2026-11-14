const { describe, it } = require('node:test');
const assert = require('node:assert');

const { validateExtractionEvidence } = require('../modules/document-intelligence/evidence/evidence-validator');

const SAMPLE_PARSED_PDF = {
  documentId: 'DOC_PDF_1',
  documentType: 'RESUME',
  parser: 'pdf',
  status: 'PARSED',
  blocks: [
    {
      blockId: 'PAGE_1_BLOCK_1',
      blockType: 'PARAGRAPH',
      pageNumber: 1,
      paragraphIndex: null,
      sectionHeading: 'Experience',
      text: 'Backend Developer at Example Company (January 2023 - Present). Built Node.js REST APIs.',
    },
  ],
};

const SAMPLE_PARSED_DOCX = {
  documentId: 'DOC_DOCX_1',
  documentType: 'RESUME',
  parser: 'docx',
  status: 'PARSED',
  blocks: [
    {
      blockId: 'PARA_0',
      blockType: 'PARAGRAPH',
      pageNumber: null,
      paragraphIndex: 0,
      sectionHeading: 'Experience',
      text: 'Senior Engineer at Acme Corp working with MongoDB and Express.',
    },
  ],
};

describe('Module 2: EvidenceValidator (TDD)', () => {
  it('29. Marks matching quote and valid PDF page reference as EXPLICIT', () => {
    const extraction = {
      workExperience: [
        {
          jobTitle: {
            value: 'Backend Developer',
            evidence: [
              {
                documentId: 'DOC_PDF_1',
                blockId: 'PAGE_1_BLOCK_1',
                pageNumber: 1,
                paragraphIndex: null,
                sectionHeading: 'Experience',
                quote: 'Backend Developer at Example Company',
                sourceType: 'RESUME',
              },
            ],
          },
        },
      ],
      validationWarnings: [],
    };

    const { validated, warnings } = validateExtractionEvidence(extraction, SAMPLE_PARSED_PDF);
    assert.strictEqual(validated.workExperience[0].jobTitle.evidence[0].verificationStatus, 'EXPLICIT');
    assert.strictEqual(warnings.length, 0);
  });

  it('30. Marks mismatched quote as UNVERIFIED and records warning', () => {
    const extraction = {
      workExperience: [
        {
          jobTitle: {
            value: 'Staff Astronaut',
            evidence: [
              {
                documentId: 'DOC_PDF_1',
                blockId: 'PAGE_1_BLOCK_1',
                pageNumber: 1,
                paragraphIndex: null,
                sectionHeading: 'Experience',
                quote: 'Staff Astronaut at NASA',
                sourceType: 'RESUME',
              },
            ],
          },
        },
      ],
      validationWarnings: [],
    };

    const { validated, warnings } = validateExtractionEvidence(extraction, SAMPLE_PARSED_PDF);
    assert.strictEqual(validated.workExperience[0].jobTitle.evidence[0].verificationStatus, 'UNVERIFIED');
    assert.ok(warnings.some((w) => w.includes('quote mismatch')));
  });

  it('31. Rejects incorrect PDF page reference and marks UNVERIFIED', () => {
    const extraction = {
      workExperience: [
        {
          jobTitle: {
            value: 'Backend Developer',
            evidence: [
              {
                documentId: 'DOC_PDF_1',
                blockId: 'PAGE_1_BLOCK_1',
                pageNumber: 99,
                paragraphIndex: null,
                sectionHeading: 'Experience',
                quote: 'Backend Developer at Example Company',
                sourceType: 'RESUME',
              },
            ],
          },
        },
      ],
      validationWarnings: [],
    };

    const { validated, warnings } = validateExtractionEvidence(extraction, SAMPLE_PARSED_PDF);
    assert.strictEqual(validated.workExperience[0].jobTitle.evidence[0].verificationStatus, 'UNVERIFIED');
    assert.ok(warnings.some((w) => w.includes('pageNumber')));
  });

  it('32. Rejects invalid DOCX paragraphIndex reference and marks UNVERIFIED', () => {
    const extraction = {
      workExperience: [
        {
          jobTitle: {
            value: 'Senior Engineer',
            evidence: [
              {
                documentId: 'DOC_DOCX_1',
                blockId: 'PARA_0',
                pageNumber: null,
                paragraphIndex: 42,
                sectionHeading: 'Experience',
                quote: 'Senior Engineer at Acme Corp',
                sourceType: 'RESUME',
              },
            ],
          },
        },
      ],
      validationWarnings: [],
    };

    const { validated, warnings } = validateExtractionEvidence(extraction, SAMPLE_PARSED_DOCX);
    assert.strictEqual(validated.workExperience[0].jobTitle.evidence[0].verificationStatus, 'UNVERIFIED');
    assert.ok(warnings.some((w) => w.includes('paragraphIndex')));
  });

  it('33. Records warning when factual non-null field has missing evidence', () => {
    const extraction = {
      workExperience: [
        {
          jobTitle: {
            value: 'Backend Developer',
            evidence: [],
          },
        },
      ],
      validationWarnings: [],
    };

    const { warnings } = validateExtractionEvidence(extraction, SAMPLE_PARSED_PDF);
    assert.ok(warnings.some((w) => w.includes('Missing supporting evidence')));
  });

  it('34. Rejects evidence with mismatched documentId', () => {
    const extraction = {
      workExperience: [
        {
          jobTitle: {
            value: 'Backend Developer',
            evidence: [
              {
                documentId: 'WRONG_DOC_ID',
                blockId: 'PAGE_1_BLOCK_1',
                pageNumber: 1,
                paragraphIndex: null,
                sectionHeading: 'Experience',
                quote: 'Backend Developer at Example Company',
                sourceType: 'RESUME',
              },
            ],
          },
        },
      ],
      validationWarnings: [],
    };

    const { validated, warnings } = validateExtractionEvidence(extraction, SAMPLE_PARSED_PDF);
    assert.strictEqual(validated.workExperience[0].jobTitle.evidence[0].verificationStatus, 'UNVERIFIED');
    assert.ok(warnings.some((w) => w.includes('documentId mismatch')));
  });
});
