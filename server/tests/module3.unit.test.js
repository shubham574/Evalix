const { describe, it } = require('node:test');
const assert = require('node:assert');

const { resolveSkillAlias } = require('../modules/candidate-intelligence/matching/skill-alias.registry');
const {
  buildCandidateFacts,
  toLlmMinimizedFacts,
} = require('../modules/candidate-intelligence/candidate-profile/candidate-facts.service');
const {
  buildCandidateProfileSnapshot,
} = require('../modules/candidate-intelligence/candidate-profile/candidate-profile.builder');
const {
  normalizeJobRequirements,
} = require('../modules/candidate-intelligence/job-requirements/requirement-normalizer');
const {
  runDeterministicMatching,
  NOT_EVIDENCED_NOTE,
} = require('../modules/candidate-intelligence/matching/deterministic-matcher');
const { runSemanticMatching } = require('../modules/candidate-intelligence/matching/semantic-matcher');
const { analyzeExperience } = require('../modules/candidate-intelligence/matching/experience-analyzer');

describe('Module 3: Unit Tests (Profile, Requirements, Matching, Experience, Security)', () => {
  it('8-14. Builds CandidateFacts preserving RESUME_EXTRACTED vs CANDIDATE_ENTERED provenance & minimizing PII', () => {
    const resumeExtraction = {
      documentId: 'DOC_RES_1',
      schemaVersion: '1.0',
      extractorVersion: '1.0.0',
      completedAt: new Date('2026-01-01T00:00:00Z'),
      extractedData: {
        personalInformation: {
          fullName: 'Shubham Maurya',
          email: 'shubham.secret@example.com',
          phone: '+91-9999999999',
          location: 'Bengaluru',
        },
        professionalHeadline: { value: 'Backend Developer', evidence: [] },
        workExperience: [
          {
            companyName: { value: 'Acme Corp', evidence: [{ documentId: 'DOC_RES_1', blockId: 'b1', pageNumber: 1, quote: 'Acme Corp', matchConfidence: 'EXPLICIT' }] },
            jobTitle: { value: 'Node.js Developer', evidence: [{ documentId: 'DOC_RES_1', blockId: 'b1', pageNumber: 1, quote: 'Node.js Developer', matchConfidence: 'EXPLICIT' }] },
            employmentType: 'FULL_TIME',
            startDate: { raw: '2023-01', normalized: '2023-01', precision: 'MONTH', evidence: [] },
            endDate: { raw: '2024-12', normalized: '2024-12', precision: 'MONTH', evidence: [] },
            isCurrent: false,
            responsibilities: [
              {
                text: 'Developed REST APIs using Express and Stripe payments',
                evidence: [{ documentId: 'DOC_RES_1', blockId: 'b2', pageNumber: 1, quote: 'Developed REST APIs using Express', matchConfidence: 'EXPLICIT' }],
              },
            ],
            achievements: [],
            technologies: [
              { name: 'NodeJS', classification: 'EXPLICIT', evidence: [{ documentId: 'DOC_RES_1', blockId: 'b2', pageNumber: 1, quote: 'NodeJS', matchConfidence: 'EXPLICIT' }] },
            ],
          },
        ],
        skills: [
          { name: 'MongoDB', category: 'DATABASE', classification: 'EXPLICIT', evidence: [{ documentId: 'DOC_RES_1', blockId: 'b3', pageNumber: 1, quote: 'MongoDB', matchConfidence: 'EXPLICIT' }] },
          { name: 'Redis', category: 'DATABASE', classification: 'EXPLICIT', evidence: [{ documentId: 'DOC_RES_1', blockId: 'b3', pageNumber: 1, quote: 'Redis', matchConfidence: 'EXPLICIT' }] },
        ],
        projects: [
          {
            name: 'Payment Integration',
            description: 'Integrated Stripe checkout',
            technologies: ['Node.js', 'Stripe'],
            responsibilities: [],
            outcomes: [],
            evidence: [{ documentId: 'DOC_RES_1', blockId: 'b4', pageNumber: 1, quote: 'Payment Integration', matchConfidence: 'EXPLICIT' }],
          },
        ],
        education: [],
        certifications: [],
      },
    };

    const { facts, evidenceRegistry } = buildCandidateFacts({
      candidateProfile: {
        currentJobTitle: 'Backend Engineer',
        totalExperienceMonths: 24,
        experienceLevel: 'JUNIOR',
      },
      candidateExperiences: [
        {
          _id: 'exp1',
          companyName: 'Self Reported Startup',
          jobTitle: 'Intern',
          employmentType: 'INTERNSHIP',
          startDate: new Date('2022-06-01'),
          endDate: new Date('2022-08-31'),
          isCurrent: false,
        },
      ],
      candidateSkills: [
        { _id: 'sk1', skillName: 'GraphQL', normalizedSkillName: 'graphql', skillCategory: 'FRAMEWORK' },
        { _id: 'sk2', skillName: 'MongoDB', normalizedSkillName: 'mongodb', skillCategory: 'DATABASE' },
      ],
      candidateProjects: [],
      resumeExtraction,
    });

    const snapshot = buildCandidateProfileSnapshot({ facts, evidenceRegistry });
    assert.ok(facts.some((f) => f.sourceType === 'RESUME_EXTRACTED' && f.value === 'NodeJS'));
    assert.ok(facts.some((f) => f.sourceType === 'CANDIDATE_ENTERED' && f.value === 'GraphQL' && f.verificationStatus === 'SELF_REPORTED'));

    // Duplicate MongoDB retains both sources in consolidated view
    const mongo = snapshot.consolidatedSkills.find((s) => s.canonicalName === 'MongoDB');
    assert.ok(mongo);
    assert.ok(mongo.sources.includes('RESUME_EXTRACTED'));
    assert.ok(mongo.sources.includes('CANDIDATE_ENTERED'));

    // 55. PII minimisation: email/phone/location must NEVER be included in LLM-minimized facts
    const minimized = JSON.stringify(toLlmMinimizedFacts(facts));
    assert.ok(!minimized.includes('shubham.secret@example.com'));
    assert.ok(!minimized.includes('9999999999'));
    assert.ok(!minimized.includes('Bengaluru'));
  });

  it('15-20. Normalizes JD requirements preserving MUST_HAVE vs PREFERRED, behavioural, functional & ambiguities', () => {
    const jdExtraction = {
      documentId: 'DOC_JD_1',
      extractedData: {
        jobInformation: {
          jobTitle: { value: 'Backend Engineer', evidence: [] },
          minimumExperienceMonths: { value: 24, evidence: [] },
        },
        skills: [
          { name: 'Node', requirementType: 'MUST_HAVE', importance: 'HIGH', evidence: [] },
          { name: 'Microservices', requirementType: 'PREFERRED', importance: 'LOW', evidence: [] },
        ],
        functionalCompetencies: ['API development'],
        behaviouralCompetencies: ['Ownership'],
        ambiguities: ['Cloud provider not specified'],
        missingInformation: ['On-call rotation'],
      },
    };

    const norm = normalizeJobRequirements({ jdExtraction });
    const nodeReq = norm.requirements.find((r) => r.normalizedName === 'Node.js');
    const microReq = norm.requirements.find((r) => r.normalizedName === 'Microservices');
    assert.strictEqual(nodeReq.requirementType, 'MUST_HAVE');
    assert.strictEqual(microReq.requirementType, 'PREFERRED');
    assert.ok(norm.requirements.some((r) => r.category === 'BEHAVIOURAL' && r.normalizedName === 'Ownership'));
    assert.ok(norm.requirements.some((r) => r.category === 'FUNCTIONAL' && r.normalizedName === 'API development'));
    assert.strictEqual(norm.ambiguities[0], 'Cloud provider not specified');
  });

  it('21-29. Deterministic & semantic matching with alias registry, non-evidenced disclaimer, and hallucinated-ref rejection', async () => {
    assert.strictEqual(resolveSkillAlias('Postgres').canonicalName, 'PostgreSQL');
    assert.strictEqual(resolveSkillAlias('JS').canonicalName, 'JavaScript');
    assert.strictEqual(resolveSkillAlias('ProprietaryFooLang').isKnownAlias, false);

    const { facts, evidenceRegistry } = buildCandidateFacts({
      candidateProfile: null,
      candidateSkills: [{ _id: 'c1', skillName: 'Docker', normalizedSkillName: 'docker' }],
      resumeExtraction: {
        documentId: 'DOC_R',
        extractedData: {
          workExperience: [
            {
              companyName: { value: 'Acme', evidence: [] },
              jobTitle: { value: 'Dev', evidence: [] },
              responsibilities: [
                {
                  text: 'Developed REST APIs using Express',
                  evidence: [{ documentId: 'DOC_R', blockId: 'b2', pageNumber: 1, quote: 'Developed REST APIs using Express', matchConfidence: 'EXPLICIT' }],
                },
              ],
              technologies: [
                { name: 'Node', classification: 'EXPLICIT', evidence: [{ documentId: 'DOC_R', blockId: 'b1', pageNumber: 1, quote: 'Node', matchConfidence: 'EXPLICIT' }] },
              ],
            },
          ],
          skills: [],
        },
      },
    });

    const jdNorm = normalizeJobRequirements({
      jdExtraction: {
        documentId: 'DOC_J',
        extractedData: {
          skills: [
            { name: 'Node.js', requirementType: 'MUST_HAVE', evidence: [] },
            { name: 'PostgreSQL', requirementType: 'MUST_HAVE', evidence: [] },
            { name: 'Docker', requirementType: 'PREFERRED', evidence: [] },
          ],
          functionalCompetencies: ['Experience building RESTful services'],
        },
      },
    });

    const det = runDeterministicMatching({
      requirements: jdNorm.requirements,
      facts,
      experienceAnalysis: null,
    });

    const nodeAss = det.assessments.find((a) => a.requirementName === 'Node.js');
    const dockerAss = det.assessments.find((a) => a.requirementName === 'Docker');
    assert.strictEqual(nodeAss.assessment, 'SUPPORTED_DIRECTLY');
    assert.strictEqual(dockerAss.assessment, 'REQUIRES_CANDIDATE_CONFIRMATION');

    const respFact = facts.find((f) => f.factType === 'RESPONSIBILITY');
    const restReq = det.unmatchedRequirements.find((r) => r.normalizedName.includes('RESTful'));
    const pgReq = det.unmatchedRequirements.find((r) => r.normalizedName === 'PostgreSQL');

    // Fake LLM returns 1 valid semantic match + 1 hallucinated fact/evidence ID for PostgreSQL
    const fakeLlm = {
      generateStructuredJson: async () => ({
        provider: 'fake',
        model: 'fake-model',
        usage: { totalTokens: 10 },
        data: {
          schemaVersion: '1.0',
          proposals: [
            {
              requirementId: restReq.requirementId,
              matchType: 'SEMANTIC_MATCH',
              assessment: 'SUPPORTED_DIRECTLY',
              candidateFactIds: [respFact.factId],
              evidenceIds: respFact.evidenceIds,
              explanation: 'Resume shows REST API development with Express.',
              missingEvidence: [],
            },
            {
              requirementId: pgReq.requirementId,
              matchType: 'SEMANTIC_MATCH',
              assessment: 'SUPPORTED_DIRECTLY',
              candidateFactIds: ['FACT_HALLUCINATED'],
              evidenceIds: ['EVD_HALLUCINATED'],
              explanation: 'Hallucinated match',
              missingEvidence: [],
            },
          ],
        },
      }),
    };

    const sem = await runSemanticMatching({
      unmatchedRequirements: det.unmatchedRequirements,
      facts,
      evidenceLookup: Object.fromEntries(evidenceRegistry.entries()),
      llmProvider: fakeLlm,
      semanticEnabled: true,
    });

    const restAss = sem.assessments.find((a) => a.requirementId === restReq.requirementId);
    const pgAss = sem.assessments.find((a) => a.requirementId === pgReq.requirementId);
    assert.strictEqual(restAss.assessment, 'SUPPORTED_DIRECTLY');
    assert.strictEqual(pgAss.assessment, 'NOT_EVIDENCED');
    assert.strictEqual(pgAss.explanation, NOT_EVIDENCED_NOTE);
    assert.ok(sem.warnings.some((w) => w.includes('FACT_HALLUCINATED')));
  });

  it('30-35. ExperienceAnalyzer merges overlapping intervals, handles year-only/missing dates, and separates internships', () => {
    const res = analyzeExperience({
      facts: [
        {
          factId: 'f1',
          factType: 'EMPLOYMENT',
          sourceType: 'RESUME_EXTRACTED',
          metadata: {
            employmentType: 'FULL_TIME',
            startDate: { raw: '2023-01', normalized: '2023-01', precision: 'MONTH' },
            endDate: { raw: '2023-12', normalized: '2023-12', precision: 'MONTH' },
          },
        },
        {
          // Overlaps 6 months with f1 (2023-07 to 2024-06 -> total merged = 18 months, NOT 24!)
          factId: 'f2',
          factType: 'EMPLOYMENT',
          sourceType: 'RESUME_EXTRACTED',
          metadata: {
            employmentType: 'FULL_TIME',
            startDate: { raw: '2023-07', normalized: '2023-07', precision: 'MONTH' },
            endDate: { raw: '2024-06', normalized: '2024-06', precision: 'MONTH' },
          },
        },
        {
          factId: 'f3',
          factType: 'EMPLOYMENT',
          sourceType: 'RESUME_EXTRACTED',
          metadata: {
            employmentType: 'INTERNSHIP',
            startDate: { raw: '2022-06', normalized: '2022-06', precision: 'MONTH' },
            endDate: { raw: '2022-08', normalized: '2022-08', precision: 'MONTH' },
          },
        },
        {
          factId: 'f4',
          factType: 'EMPLOYMENT',
          sourceType: 'RESUME_EXTRACTED',
          metadata: {
            employmentType: 'FULL_TIME',
            startDate: { raw: null, normalized: null, precision: 'UNKNOWN' },
            endDate: { raw: null, normalized: null, precision: 'UNKNOWN' },
          },
        },
      ],
      reportedExperienceMonths: 24,
      jobRequiredMinimumMonths: 24,
    });

    assert.strictEqual(res.derivedExperienceMonths, 18);
    assert.strictEqual(res.internshipMonths, 3);
    assert.strictEqual(res.derivationStatus, 'PARTIALLY_VERIFIABLE');
    assert.strictEqual(res.assessment, 'REQUIRES_CANDIDATE_CONFIRMATION');
  });

  it('Security 2A: Rejects ALLOW_UNSCANNED=true in staging/production without explicit override', () => {
    const envPath = require.resolve('../config/env');
    const prevNodeEnv = process.env.NODE_ENV;
    const prevAllow = process.env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED;
    const prevOverride = process.env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED_OVERRIDE;

    try {
      for (const targetEnv of ['staging', 'production']) {
        process.env.NODE_ENV = targetEnv;
        process.env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED = 'true';
        delete process.env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED_OVERRIDE;
        delete require.cache[envPath];
        assert.throws(() => require('../config/env'), /Security policy violation/);
      }
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      if (prevAllow === undefined) delete process.env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED;
      else process.env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED = prevAllow;
      if (prevOverride === undefined) delete process.env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED_OVERRIDE;
      else process.env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED_OVERRIDE = prevOverride;
      delete require.cache[envPath];
    }
  });
});
