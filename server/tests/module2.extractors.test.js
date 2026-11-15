const { describe, it } = require('node:test');
const assert = require('node:assert');

const { extractResumeIntelligence } = require('../modules/document-intelligence/resume/resume-extractor');
const { extractJdIntelligence } = require('../modules/document-intelligence/job-description/jd-extractor');

const RESUME_PARSED = {
  documentId: 'DOC_RES_1',
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
      text: 'Software Engineer at Alpha Tech (2022 - Present). Built Node.js microservices. Also worked at Beta Systems (2020 - 2022).',
    },
    {
      blockId: 'PAGE_1_BLOCK_2',
      blockType: 'PARAGRAPH',
      pageNumber: 1,
      paragraphIndex: null,
      sectionHeading: 'Projects',
      text: 'Project: Evalix API - Built with Express and MongoDB.',
    },
  ],
};

const JD_PARSED = {
  documentId: 'DOC_JD_1',
  documentType: 'JOB_DESCRIPTION',
  parser: 'text',
  status: 'PARSED',
  blocks: [
    {
      blockId: 'TEXT_BLOCK_0',
      blockType: 'TEXT',
      pageNumber: null,
      paragraphIndex: 0,
      sectionHeading: null,
      text: 'Backend Developer. Must have Node.js and MongoDB. Preferred: Redis. Strong communication and ownership.',
    },
  ],
};

const makeFakeProvider = (responder) => ({
  generateStructuredJson: async (args) => ({
    data: await responder(args),
    provider: 'fake-gemini',
    model: 'gemini-3.5-flash',
    requestId: args.requestId,
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
  }),
});

describe('Module 2: Resume & JD Extractors (TDD)', () => {
  it('14-22. Extracts multiple employers, projects, incomplete dates, missing education, explicit vs inferred skills, and flags unsupported claims', async () => {
    const fakeProvider = makeFakeProvider(() => ({
      personalInformation: { fullName: null, email: null, phone: null, location: null },
      professionalSummary: { text: null, evidence: [] },
      professionalHeadline: { value: null, evidence: [] },
      workExperience: [
        {
          companyName: {
            value: 'Alpha Tech',
            evidence: [{ documentId: 'DOC_RES_1', blockId: 'PAGE_1_BLOCK_1', pageNumber: 1, quote: 'Alpha Tech', sourceType: 'RESUME' }],
          },
          jobTitle: {
            value: 'Software Engineer',
            evidence: [{ documentId: 'DOC_RES_1', blockId: 'PAGE_1_BLOCK_1', pageNumber: 1, quote: 'Software Engineer at Alpha Tech', sourceType: 'RESUME' }],
          },
          startDate: {
            raw: '2022',
            normalized: '2022',
            precision: 'YEAR',
            evidence: [{ documentId: 'DOC_RES_1', blockId: 'PAGE_1_BLOCK_1', pageNumber: 1, quote: '2022 - Present', sourceType: 'RESUME' }],
          },
          endDate: { raw: 'Present', normalized: null, precision: 'OPEN_ENDED', evidence: [] },
          isCurrent: true,
          responsibilities: [],
          achievements: [],
          technologies: [],
        },
        {
          companyName: {
            value: 'Beta Systems',
            evidence: [{ documentId: 'DOC_RES_1', blockId: 'PAGE_1_BLOCK_1', pageNumber: 1, quote: 'Beta Systems', sourceType: 'RESUME' }],
          },
          jobTitle: { value: null, evidence: [] },
          startDate: { raw: '2020', normalized: '2020', precision: 'YEAR', evidence: [] },
          endDate: { raw: '2022', normalized: '2022', precision: 'YEAR', evidence: [] },
          isCurrent: false,
        },
      ],
      skills: [
        {
          name: 'Node.js',
          classification: 'EXPLICIT',
          evidence: [{ documentId: 'DOC_RES_1', blockId: 'PAGE_1_BLOCK_1', pageNumber: 1, quote: 'Node.js', sourceType: 'RESUME' }],
        },
        {
          name: 'Distributed Systems',
          classification: 'INFERRED',
          evidence: [],
        },
        {
          name: 'HallucinatedSkill',
          classification: 'EXPLICIT',
          evidence: [{ documentId: 'DOC_RES_1', blockId: 'PAGE_1_BLOCK_1', pageNumber: 1, quote: '10 years Rust', sourceType: 'RESUME' }],
        },
      ],
      projects: [
        {
          name: 'Evalix API',
          technologies: ['Express', 'MongoDB'],
          evidence: [{ documentId: 'DOC_RES_1', blockId: 'PAGE_1_BLOCK_2', pageNumber: 1, quote: 'Evalix API', sourceType: 'RESUME' }],
        },
      ],
      education: [],
      certifications: [],
      missingInformation: ['education', 'achievements'],
      ambiguities: [],
      validationWarnings: [],
    }));

    const { extraction, metadata } = await extractResumeIntelligence({
      parsedDoc: RESUME_PARSED,
      llmProvider: fakeProvider,
    });

    assert.strictEqual(extraction.workExperience.length, 2);
    assert.strictEqual(extraction.workExperience[0].startDate.precision, 'YEAR');
    assert.strictEqual(extraction.workExperience[0].startDate.normalized, '2022');
    assert.strictEqual(extraction.education.length, 0);
    assert.strictEqual(extraction.skills[0].evidence[0].verificationStatus, 'EXPLICIT');
    assert.strictEqual(extraction.skills[2].evidence[0].verificationStatus, 'UNVERIFIED');
    assert.strictEqual(extraction.extractionStatus, 'COMPLETED_WITH_WARNINGS');
    assert.strictEqual(metadata.totalTokens, 300);
  });

  it('23-28. Extracts JD distinguishing MUST_HAVE vs PREFERRED skills, ambiguities, and behavioural competencies', async () => {
    const fakeProvider = makeFakeProvider(() => ({
      jobInformation: {
        jobTitle: {
          value: 'Backend Developer',
          evidence: [{ documentId: 'DOC_JD_1', blockId: 'TEXT_BLOCK_0', paragraphIndex: 0, quote: 'Backend Developer', sourceType: 'JOB_DESCRIPTION' }],
        },
        companyName: { value: null, evidence: [] },
        seniorityLevel: { value: null, evidence: [] },
        minimumExperienceMonths: { value: null, evidence: [] },
        maximumExperienceMonths: { value: null, evidence: [] },
        location: null,
        workArrangement: null,
      },
      responsibilities: [],
      skills: [
        {
          name: 'Node.js',
          requirementType: 'MUST_HAVE',
          importance: 'HIGH',
          evidence: [{ documentId: 'DOC_JD_1', blockId: 'TEXT_BLOCK_0', paragraphIndex: 0, quote: 'Node.js', sourceType: 'JOB_DESCRIPTION' }],
        },
        {
          name: 'Redis',
          requirementType: 'PREFERRED',
          importance: 'MEDIUM',
          evidence: [{ documentId: 'DOC_JD_1', blockId: 'TEXT_BLOCK_0', paragraphIndex: 0, quote: 'Preferred: Redis', sourceType: 'JOB_DESCRIPTION' }],
        },
      ],
      behaviouralCompetencies: ['Strong communication', 'Ownership'],
      ambiguities: ['Years of experience not specified'],
      missingInformation: ['location', 'companyName'],
      validationWarnings: [],
    }));

    const { extraction } = await extractJdIntelligence({
      parsedDoc: JD_PARSED,
      llmProvider: fakeProvider,
    });

    const nodeSkill = extraction.skills.find((s) => s.name === 'Node.js');
    const redisSkill = extraction.skills.find((s) => s.name === 'Redis');
    assert.strictEqual(nodeSkill.requirementType, 'MUST_HAVE');
    assert.strictEqual(redisSkill.requirementType, 'PREFERRED');
    assert.strictEqual(extraction.jobInformation.minimumExperienceMonths.value, null);
    assert.strictEqual(extraction.jobInformation.location, null);
    assert.ok(extraction.behaviouralCompetencies.includes('Ownership'));
    assert.strictEqual(extraction.extractionStatus, 'COMPLETED');
  });

  it('Rejects invalid LLM JSON failing Zod schema', async () => {
    const badProvider = makeFakeProvider(() => ({
      workExperience: 'not-an-array',
    }));

    await assert.rejects(
      () =>
        extractResumeIntelligence({
          parsedDoc: RESUME_PARSED,
          llmProvider: badProvider,
        }),
      (err) => err.code === 'EXTRACTION_SCHEMA_INVALID'
    );
  });

  it('Resiliently coerces LLM objects into flat strings for employmentType, location, competencies, and qualifications', async () => {
    // Simulates the exact LLM shape from Gemini that previously caused EXTRACTION_SCHEMA_INVALID
    const realGeminiShapeProvider = makeFakeProvider(() => ({
      jobInformation: {
        jobTitle: { value: 'Senior Backend Engineer', evidence: [{ documentId: 'DOC_JD_1', blockId: 'TEXT_BLOCK_0', paragraphIndex: 0, quote: 'Backend Developer', sourceType: 'JOB_DESCRIPTION' }] },
        companyName: { value: 'Evalix Corp', evidence: [] },
        seniorityLevel: { value: 'Senior', evidence: [] },
        minimumExperienceMonths: { value: 36, evidence: [] },
        maximumExperienceMonths: { value: null, evidence: [] },
        employmentType: { type: 'Full-time' },
        location: { city: 'Bengaluru', country: 'India' },
        workArrangement: { type: 'Hybrid' },
      },
      responsibilities: [{ text: 'Architect scalable backend systems', priority: 'CORE', evidence: [] }],
      skills: [{ name: 'Node.js', requirementType: 'MUST_HAVE', importance: 'HIGH', evidence: [{ documentId: 'DOC_JD_1', blockId: 'TEXT_BLOCK_0', paragraphIndex: 0, quote: 'Node.js', sourceType: 'JOB_DESCRIPTION' }] }],
      technicalCompetencies: [
        { competency: 'Microservices Architecture', level: 'Advanced' },
        { name: 'Distributed Systems' },
      ],
      behaviouralCompetencies: [
        { competency: 'Team Mentorship' },
      ],
      requiredQualifications: [
        { qualification: 'B.Tech in Computer Science' },
      ],
      preferredQualifications: [
        { qualification: 'AWS Certified Solutions Architect' },
      ],
      domainKnowledge: [
        { domain: 'Fintech and Payments' },
      ],
      expectedOutcomes: ['Deliver 99.99% uptime'],
      ambiguities: [],
      missingInformation: [],
      validationWarnings: [],
    }));

    const { extraction } = await extractJdIntelligence({
      parsedDoc: JD_PARSED,
      llmProvider: realGeminiShapeProvider,
    });

    assert.strictEqual(extraction.jobInformation.employmentType, 'Full-time');
    assert.strictEqual(extraction.jobInformation.location, 'Bengaluru');
    assert.strictEqual(extraction.jobInformation.workArrangement, 'Hybrid');
    assert.deepStrictEqual(extraction.technicalCompetencies, ['Microservices Architecture', 'Distributed Systems']);
    assert.deepStrictEqual(extraction.behaviouralCompetencies, ['Team Mentorship']);
    assert.deepStrictEqual(extraction.requiredQualifications, ['B.Tech in Computer Science']);
    assert.deepStrictEqual(extraction.preferredQualifications, ['AWS Certified Solutions Architect']);
    assert.deepStrictEqual(extraction.domainKnowledge, ['Fintech and Payments']);
    assert.strictEqual(extraction.extractionStatus, 'COMPLETED_WITH_WARNINGS');
  });
});
