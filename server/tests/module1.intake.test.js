const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Isolate storage & test auth BEFORE loading app/env
const tempStorageDir = path.join(os.tmpdir(), `evalix-m1-test-${Date.now()}`);
process.env.NODE_ENV = 'test';
process.env.ENABLE_TEST_AUTH = 'true';
process.env.DOCUMENT_STORAGE_PATH = tempStorageDir;
process.env.MAX_DOCUMENT_SIZE_BYTES = String(512 * 1024); // 512KB for fast size-limit tests
process.env.DOCUMENT_SIGNING_SECRET = 'test-signing-secret-12345';

const app = require('../app');
const { syncModule1Indexes } = require('../database/migrations/001_module1_candidate_intake_indexes');
const { intakeEventBus, INTAKE_EVENTS } = require('../modules/common/events/intakeEvents');
const documentRepo = require('../modules/documents/document.repository');
const intakeRepo = require('../modules/intake/intake.repository');
const { TargetJobProfile } = require('../modules/job-profile/targetJobProfile.model');

const USER_A = { 'x-test-user-id': 'user_candidate_a' };
const USER_B = { 'x-test-user-id': 'user_candidate_b' };

// Minimal valid PDF buffer (%PDF-1.4 header)
const JSZip = require('jszip');

const VALID_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'
);

let VALID_DOCX_BUFFER;

let replSet;

async function clearCollections() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

describe('Module 1: Candidate Intake & Profile Management Integration Tests', () => {
  before(async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types></Types>');
    zip.file('word/document.xml', '<w:document/>');
    VALID_DOCX_BUFFER = await zip.generateAsync({ type: 'nodebuffer' });

    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    await syncModule1Indexes();
  });

  after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
    await fsp.rm(tempStorageDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it('L. Rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/candidates/profile');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  it('A, B, C. Creates, retrieves, updates candidate profile & enforces duplicate/concurrency rules', async () => {
    // A. Create profile
    const createRes = await request(app)
      .post('/api/v1/candidates/profile')
      .set(USER_A)
      .send({
        fullName: 'Shubham Maurya',
        email: 'shubham@example.com',
        phone: '+91 9876543210',
        currentJobTitle: 'Backend Developer',
        totalExperienceMonths: 24,
        experienceLevel: 'JUNIOR',
      });

    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.success, true);
    assert.strictEqual(createRes.body.data.fullName, 'Shubham Maurya');
    assert.strictEqual(createRes.body.data.version, 1);

    // Duplicate profile rejected with 409
    const dupRes = await request(app)
      .post('/api/v1/candidates/profile')
      .set(USER_A)
      .send({
        fullName: 'Shubham Maurya',
        email: 'shubham@example.com',
        totalExperienceMonths: 24,
        experienceLevel: 'JUNIOR',
      });
    assert.strictEqual(dupRes.status, 409);
    assert.strictEqual(dupRes.body.code, 'PROFILE_ALREADY_EXISTS');

    // B. Get full profile
    const getRes = await request(app).get('/api/v1/candidates/profile').set(USER_A);
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.data.profile.email, 'shubham@example.com');
    assert.ok(Array.isArray(getRes.body.data.experiences));
    assert.ok(Array.isArray(getRes.body.data.skills));
    assert.ok(Array.isArray(getRes.body.data.projects));
    assert.ok(Array.isArray(getRes.body.data.documents));

    // C. Update profile + optimistic concurrency check
    const updateRes = await request(app)
      .put('/api/v1/candidates/profile')
      .set(USER_A)
      .send({
        currentJobTitle: 'Senior Backend Developer',
        totalExperienceMonths: 36,
        expectedVersion: 1,
      });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.version, 2);
    assert.strictEqual(updateRes.body.data.currentJobTitle, 'Senior Backend Developer');

    // Stale expectedVersion rejected with 409
    const staleRes = await request(app)
      .patch('/api/v1/candidates/profile')
      .set(USER_A)
      .send({ currentJobTitle: 'Staff Engineer', expectedVersion: 1 });
    assert.strictEqual(staleRes.status, 409);
    assert.strictEqual(staleRes.body.code, 'CONCURRENT_MODIFICATION');
  });

  it('D, E. Manages multiple experiences, skills (add/edit/delete), and projects with validation', async () => {
    await request(app).post('/api/v1/candidates/profile').set(USER_A).send({
      fullName: 'Test Candidate',
      email: 'test@example.com',
      totalExperienceMonths: 18,
      experienceLevel: 'JUNIOR',
    });

    // D. Multiple experiences
    const exp1 = await request(app).post('/api/v1/candidates/experiences').set(USER_A).send({
      companyName: 'Acme Corp',
      jobTitle: 'Junior Engineer',
      employmentType: 'FULL_TIME',
      startDate: '2023-01-01',
      endDate: '2024-01-01',
      isCurrent: false,
      description: 'Built REST APIs',
    });
    assert.strictEqual(exp1.status, 201);

    const exp2 = await request(app).post('/api/v1/candidates/experiences').set(USER_A).send({
      companyName: 'Evalix Labs',
      jobTitle: 'Backend Engineer',
      employmentType: 'FULL_TIME',
      startDate: '2024-02-01',
      isCurrent: true,
      description: 'Microservices & Node.js',
    });
    assert.strictEqual(exp2.status, 201);

    // Invalid date range rejected
    const badExp = await request(app).post('/api/v1/candidates/experiences').set(USER_A).send({
      companyName: 'Bad Dates Inc',
      jobTitle: 'Dev',
      startDate: '2024-05-01',
      endDate: '2024-01-01',
      isCurrent: false,
    });
    assert.strictEqual(badExp.status, 400);

    // E. Skills add, edit, delete
    const skillAdd = await request(app).post('/api/v1/candidates/skills').set(USER_A).send({
      skills: [
        { skillName: 'Node.js', skillCategory: 'FRAMEWORK', selfReportedProficiency: 'ADVANCED' },
        { skillName: 'MongoDB', skillCategory: 'DATABASE', selfReportedProficiency: 'INTERMEDIATE' },
      ],
    });
    assert.strictEqual(skillAdd.status, 201);
    assert.strictEqual(skillAdd.body.data.length, 2);

    const mongoSkillId = skillAdd.body.data.find((s) => s.skillName === 'MongoDB').id;
    const skillPatch = await request(app)
      .patch(`/api/v1/candidates/skills/${mongoSkillId}`)
      .set(USER_A)
      .send({ selfReportedProficiency: 'ADVANCED' });
    assert.strictEqual(skillPatch.status, 200);
    assert.strictEqual(skillPatch.body.data.selfReportedProficiency, 'ADVANCED');

    const skillDel = await request(app)
      .delete(`/api/v1/candidates/skills/${mongoSkillId}`)
      .set(USER_A);
    assert.strictEqual(skillDel.status, 200);

    // Projects add + URL validation
    const badProj = await request(app).post('/api/v1/candidates/projects').set(USER_A).send({
      projectTitle: 'Bad URL Project',
      projectDescription: 'Testing invalid URL rejection',
      projectUrl: 'ftp://invalid-scheme.example.com',
    });
    assert.strictEqual(badProj.status, 400);

    const projAdd = await request(app).post('/api/v1/candidates/projects').set(USER_A).send({
      projectTitle: 'Evalix Platform',
      projectDescription: 'AI-powered technical interview platform',
      technologies: ['Node.js', 'MongoDB', 'React'],
      projectUrl: 'https://github.com/example/evalix',
      candidateResponsibility: 'Designed backend APIs',
    });
    assert.strictEqual(projAdd.status, 201);

    const fullProfile = await request(app).get('/api/v1/candidates/profile').set(USER_A);
    assert.strictEqual(fullProfile.body.data.experiences.length, 2);
    assert.strictEqual(fullProfile.body.data.skills.length, 1);
    assert.strictEqual(fullProfile.body.data.projects.length, 1);
  });

  it('F, G, H, I, J, M, O. Full intake lifecycle: create, upload resume/JD, reject invalid docs, deduplicate, submit, and enforce state machine', async () => {
    await request(app).post('/api/v1/candidates/profile').set(USER_A).send({
      fullName: 'Shubham',
      email: 'shubham@example.com',
      totalExperienceMonths: 18,
      experienceLevel: 'JUNIOR',
    });

    // F. Create draft intake
    const intakeRes = await request(app).post('/api/v1/interview-intakes').set(USER_A).send({
      targetJob: {
        role: 'Backend Developer',
        company: 'Example Co',
        experienceRequired: '1-3 years',
        jobDescription: 'Build scalable Node.js and MongoDB backend services with REST APIs.',
      },
      interviewPreferences: {
        interviewType: 'MIXED',
        durationMinutes: 45,
      },
    });
    assert.strictEqual(intakeRes.status, 201);
    assert.strictEqual(intakeRes.body.data.status, 'DRAFT');
    const intakeId = intakeRes.body.data.intakeId;

    // Submitting without resume fails
    const noResumeSubmit = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/submit`)
      .set(USER_A);
    assert.strictEqual(noResumeSubmit.status, 400);
    assert.strictEqual(noResumeSubmit.body.code, 'RESUME_REQUIRED');

    // H. Invalid document rejection (spoofed PDF magic bytes)
    const spoofedPdf = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/resume`)
      .set(USER_A)
      .attach('resume', Buffer.from('THIS IS NOT A PDF'), {
        filename: '../../evil.pdf',
        contentType: 'application/pdf',
      });
    assert.strictEqual(spoofedPdf.status, 400);
    assert.strictEqual(spoofedPdf.body.code, 'INVALID_DOCUMENT_SIGNATURE');

    // H. Empty file rejection
    const emptyPdf = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/resume`)
      .set(USER_A)
      .attach('resume', Buffer.alloc(0), {
        filename: 'empty.pdf',
        contentType: 'application/pdf',
      });
    assert.strictEqual(emptyPdf.status, 400);
    assert.strictEqual(emptyPdf.body.code, 'EMPTY_DOCUMENT');

    // H. Oversized file rejection (> 512KB in test env)
    const oversizedBuf = Buffer.concat([VALID_PDF_BUFFER, Buffer.alloc(600 * 1024, 0x41)]);
    const oversizedRes = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/resume`)
      .set(USER_A)
      .attach('resume', oversizedBuf, {
        filename: 'huge.pdf',
        contentType: 'application/pdf',
      });
    assert.strictEqual(oversizedRes.status, 400);
    assert.strictEqual(oversizedRes.body.code, 'FILE_TOO_LARGE');

    // G. Valid PDF resume upload
    const resumeRes = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/resume`)
      .set(USER_A)
      .attach('resume', VALID_PDF_BUFFER, {
        filename: 'my_resume.pdf',
        contentType: 'application/pdf',
      });
    assert.strictEqual(resumeRes.status, 200);
    assert.strictEqual(resumeRes.body.data.deduplicated, false);
    assert.ok(['SIGNATURE_VERIFIED_NO_AV', 'MALWARE_SCANNED_CLEAN'].includes(resumeRes.body.data.document.securityStatus));
    assert.strictEqual(resumeRes.body.data.document.storageKey, undefined);

    // O. Upload retry with identical file deduplicates instead of creating duplicate DB record
    const retryRes = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/resume`)
      .set(USER_A)
      .attach('resume', VALID_PDF_BUFFER, {
        filename: 'my_resume_copy.pdf',
        contentType: 'application/pdf',
      });
    assert.strictEqual(retryRes.status, 200);
    assert.strictEqual(retryRes.body.data.deduplicated, true);
    assert.strictEqual(retryRes.body.data.document.id, resumeRes.body.data.document.id);

    // I. Upload DOCX job description document
    const jdDocRes = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/job-description`)
      .set(USER_A)
      .attach('jobDescription', VALID_DOCX_BUFFER, {
        filename: 'backend_jd.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    assert.strictEqual(jdDocRes.status, 200);
    assert.strictEqual(jdDocRes.body.data.document.documentType, 'JOB_DESCRIPTION');

    // J. Submit intake and verify Module 2 integration event
    let emittedEvent = null;
    const listener = (evt) => {
      emittedEvent = evt;
    };
    intakeEventBus.once(INTAKE_EVENTS.INTERVIEW_INTAKE_SUBMITTED, listener);

    const submitRes = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/submit`)
      .set(USER_A);

    assert.strictEqual(submitRes.status, 200);
    assert.strictEqual(submitRes.body.data.status, 'READY_FOR_ANALYSIS');
    assert.ok(submitRes.body.data.submittedAt);
    assert.ok(emittedEvent);
    assert.strictEqual(emittedEvent.event, 'INTERVIEW_INTAKE_SUBMITTED');
    assert.strictEqual(emittedEvent.intakeId, intakeId);

    // M. Invalid state transitions after submission (cannot re-submit or mutate submitted intake)
    const resubmitRes = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/submit`)
      .set(USER_A);
    assert.strictEqual(resubmitRes.status, 409);
    assert.strictEqual(resubmitRes.body.code, 'INVALID_STATE_TRANSITION');

    const patchSubmitted = await request(app)
      .patch(`/api/v1/interview-intakes/${intakeId}`)
      .set(USER_A)
      .send({ interviewPreferences: { durationMinutes: 60 } });
    assert.strictEqual(patchSubmitted.status, 409);
    assert.strictEqual(patchSubmitted.body.code, 'INTAKE_ALREADY_SUBMITTED');

    // Explicit versioning policy: create a new draft revision without overwriting submitted intake
    const revRes = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/revisions`)
      .set(USER_A);
    assert.strictEqual(revRes.status, 201);
    assert.strictEqual(revRes.body.data.status, 'DRAFT');
    assert.strictEqual(revRes.body.data.version, submitRes.body.data.version + 1);
    assert.strictEqual(revRes.body.data.parentIntakeId, intakeId);
  });

  it('K. Enforces strict candidate ownership and signed document download security (IDOR prevention)', async () => {
    await request(app).post('/api/v1/candidates/profile').set(USER_A).send({
      fullName: 'User A',
      email: 'a@example.com',
      totalExperienceMonths: 12,
      experienceLevel: 'JUNIOR',
    });
    await request(app).post('/api/v1/candidates/profile').set(USER_B).send({
      fullName: 'User B',
      email: 'b@example.com',
      totalExperienceMonths: 12,
      experienceLevel: 'JUNIOR',
    });

    const intakeRes = await request(app).post('/api/v1/interview-intakes').set(USER_A).send({
      targetJob: {
        role: 'Fullstack Engineer',
        jobDescription: 'React and Node.js role requiring strong API design.',
      },
    });
    const intakeId = intakeRes.body.data.intakeId;

    const uploadRes = await request(app)
      .post(`/api/v1/interview-intakes/${intakeId}/resume`)
      .set(USER_A)
      .attach('resume', VALID_PDF_BUFFER, {
        filename: 'a_resume.pdf',
        contentType: 'application/pdf',
      });
    const documentId = uploadRes.body.data.document.id;

    // User B cannot read, update, upload to, or submit User A's intake
    const bGet = await request(app).get(`/api/v1/interview-intakes/${intakeId}`).set(USER_B);
    assert.strictEqual(bGet.status, 404);

    const bPatch = await request(app)
      .patch(`/api/v1/interview-intakes/${intakeId}`)
      .set(USER_B)
      .send({ targetJob: { role: 'Hacked' } });
    assert.strictEqual(bPatch.status, 404);

    const bDownloadUrl = await request(app)
      .get(`/api/v1/documents/${documentId}/download-url`)
      .set(USER_B);
    assert.strictEqual(bDownloadUrl.status, 404);

    // User A can generate signed download URL and download the file
    const aDownloadUrl = await request(app)
      .get(`/api/v1/documents/${documentId}/download-url`)
      .set(USER_A);
    assert.strictEqual(aDownloadUrl.status, 200);

    const dlRes = await request(app).get(aDownloadUrl.body.data.downloadUrl).set(USER_A);
    assert.strictEqual(dlRes.status, 200);
    assert.strictEqual(dlRes.headers['x-content-type-options'], 'nosniff');
    assert.ok(Buffer.from(dlRes.body).equals(VALID_PDF_BUFFER));

    // Tampered signature is rejected with 403
    const tamperedUrl = aDownloadUrl.body.data.downloadUrl.replace(/sig=[a-f0-9]+/, 'sig=deadbeef');
    const tamperedRes = await request(app).get(tamperedUrl).set(USER_A);
    assert.strictEqual(tamperedRes.status, 403);
    assert.strictEqual(tamperedRes.body.code, 'INVALID_SIGNED_URL');
  });

  it('N, P. Rolls back DB transaction on failure and cleans up private/temp files when DB persistence fails', async () => {
    await request(app).post('/api/v1/candidates/profile').set(USER_A).send({
      fullName: 'Tx User',
      email: 'tx@example.com',
      totalExperienceMonths: 10,
      experienceLevel: 'JUNIOR',
    });

    // N. Simulate DB failure during intake creation transaction
    const originalCreateIntake = intakeRepo.createIntake;
    intakeRepo.createIntake = async () => {
      throw new Error('Simulated DB failure inside transaction');
    };

    try {
      const txFailRes = await request(app).post('/api/v1/interview-intakes').set(USER_A).send({
        targetJob: {
          role: 'Platform Engineer',
          jobDescription: 'Kubernetes and Terraform infrastructure engineering role.',
        },
      });
      assert.strictEqual(txFailRes.status, 500);
      const jobCount = await TargetJobProfile.countDocuments({});
      assert.strictEqual(jobCount, 0, 'TargetJobProfile should be rolled back on transaction failure');
    } finally {
      intakeRepo.createIntake = originalCreateIntake;
    }

    // Create valid intake for file cleanup test
    const intakeRes = await request(app).post('/api/v1/interview-intakes').set(USER_A).send({
      targetJob: {
        role: 'Platform Engineer',
        jobDescription: 'Kubernetes and Terraform infrastructure engineering role.',
      },
    });
    const intakeId = intakeRes.body.data.intakeId;

    // P. Simulate DB failure during document metadata persistence
    const walkFiles = (dir) => {
      if (!fs.existsSync(dir)) return [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walkFiles(full) : [full];
      });
    };
    const filesBefore = walkFiles(tempStorageDir).length;

    const originalCreateDoc = documentRepo.createDocument;
    documentRepo.createDocument = async () => {
      throw new Error('Simulated document DB write failure');
    };

    try {
      const failUpload = await request(app)
        .post(`/api/v1/interview-intakes/${intakeId}/resume`)
        .set(USER_A)
        .attach('resume', VALID_PDF_BUFFER, {
          filename: 'cleanup_test.pdf',
          contentType: 'application/pdf',
        });
      assert.strictEqual(failUpload.status, 500);

      // Verify no orphaned files remain in private storage or .tmp
      const filesAfter = walkFiles(tempStorageDir).length;
      const tmpFiles = walkFiles(path.join(tempStorageDir, '.tmp')).length;
      assert.strictEqual(filesAfter, filesBefore, 'All failed upload files must be cleaned up on DB failure');
      assert.strictEqual(tmpFiles, 0, 'No temporary files should remain after failed upload');
    } finally {
      documentRepo.createDocument = originalCreateDoc;
    }
  });
});
