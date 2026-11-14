const crypto = require('crypto');
const env = require('../../../config/env');
const AppError = require('../../common/errors/AppError');
const { withTransaction } = require('../../common/db/transaction');
const { InterviewIntake } = require('../../intake/interviewIntake.model');
const { CandidateDocument } = require('../../documents/candidateDocument.model');
const { TargetJobProfile } = require('../../job-profile/targetJobProfile.model');
const { getStorageAdapter } = require('../../documents/storage.adapter');
const { parseDocument, parsePlainTextDocument } = require('../parsers/parser.factory');
const { GeminiExtractionProvider, LlmProviderError } = require('../providers/llm.provider');
const { RESUME_EXTRACTOR_VERSION, extractResumeIntelligence } = require('../resume/resume-extractor');
const { JD_EXTRACTOR_VERSION, extractJdIntelligence } = require('../job-description/jd-extractor');
const extractionRepo = require('./extraction.repository');
const jobRepo = require('../jobs/extraction-job.repository');
const { extractionStateMachine } = require('./extraction-state-machine');

const PARSER_VERSION = '1.0.0';
const SCHEMA_VERSION = '1.0';

const logTelemetry = (event, fields = {}) => {
  if (process.env.NODE_ENV === 'test') return;
  console.info(JSON.stringify({ module: 'document-intelligence', event, timestamp: new Date().toISOString(), ...fields }));
};

const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

const sha256 = (text) => crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');

/**
 * Validate intake & ownership, then idempotently create IntakeIntelligenceRun
 * and persistent DocumentExtractionJob records.
 */
const enqueueIntakeIntelligence = async (intakeId) => {
  const intake = await InterviewIntake.findById(intakeId).lean();
  if (!intake) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }
  if (!['READY_FOR_ANALYSIS', 'ANALYSIS_PENDING'].includes(intake.status)) {
    return null;
  }

  const [resumeDoc, targetJob] = await Promise.all([
    CandidateDocument.findOne({
      _id: intake.resumeDocumentId,
      userId: intake.userId,
      documentType: 'RESUME',
      uploadStatus: 'VALIDATED',
    }).lean(),
    TargetJobProfile.findOne({
      _id: intake.targetJobProfileId,
      userId: intake.userId,
    }).lean(),
  ]);

  if (!resumeDoc) {
    throw new AppError(400, 'Validated resume document not found for intake', 'INVALID_RESUME_DOCUMENT');
  }
  if (!targetJob) {
    throw new AppError(400, 'Target job profile not found for intake', 'TARGET_JOB_NOT_FOUND');
  }

  let jdDoc = null;
  if (targetJob.jobDescriptionDocumentId) {
    jdDoc = await CandidateDocument.findOne({
      _id: targetJob.jobDescriptionDocumentId,
      userId: intake.userId,
      documentType: 'JOB_DESCRIPTION',
      uploadStatus: 'VALIDATED',
    }).lean();
    if (!jdDoc) {
      throw new AppError(400, 'Job description document ownership or status invalid', 'INVALID_JD_DOCUMENT');
    }
  }

  const hasJdText = Boolean(targetJob.jobDescriptionText && targetJob.jobDescriptionText.trim().length > 0);
  if (!jdDoc && !hasJdText) {
    throw new AppError(400, 'No job description document or text available', 'JOB_DESCRIPTION_REQUIRED');
  }

  const jdSourceKind = jdDoc ? 'DOCUMENT' : 'TEXT';
  const jdDocumentId = jdDoc ? String(jdDoc._id) : `TEXT_JD_${String(targetJob._id)}`;
  const jdChecksum = jdDoc ? jdDoc.checksum : sha256(targetJob.jobDescriptionText);
  const jobDescriptionSourceKey = jdDoc ? `doc:${jdDocumentId}:${jdChecksum}` : `text:${jdChecksum}`;

  const existingRun = await extractionRepo.findRunByVersions({
    intakeId: intake._id,
    resumeDocumentId: resumeDoc._id,
    resumeChecksum: resumeDoc.checksum,
    jobDescriptionSourceKey,
  });
  if (existingRun) {
    return existingRun;
  }

  const run = await withTransaction(async (session) => {
    const createdRun = await extractionRepo.createRunIdempotent(
      {
        intakeId: intake._id,
        candidateProfileId: intake.candidateProfileId,
        userId: intake.userId,
        resumeDocumentId: resumeDoc._id,
        resumeChecksum: resumeDoc.checksum,
        jobDescriptionSourceKey,
        jobDescriptionDocumentId: jdDoc ? jdDoc._id : null,
        status: 'PENDING',
      },
      session
    );

    const nowMs = Date.now();
    const resumeJob = await jobRepo.createJobIdempotent(
      {
        intakeId: intake._id,
        runId: createdRun._id,
        candidateProfileId: intake.candidateProfileId,
        userId: intake.userId,
        documentId: String(resumeDoc._id),
        sourceKind: 'DOCUMENT',
        documentType: 'RESUME',
        documentChecksum: resumeDoc.checksum,
        extractorVersion: RESUME_EXTRACTOR_VERSION,
        schemaVersion: SCHEMA_VERSION,
        status: 'QUEUED',
        nextAttemptAt: new Date(nowMs),
        maximumAttempts: env.DOCUMENT_EXTRACTION_MAX_ATTEMPTS,
      },
      session
    );

    const jdJob = await jobRepo.createJobIdempotent(
      {
        intakeId: intake._id,
        runId: createdRun._id,
        candidateProfileId: intake.candidateProfileId,
        userId: intake.userId,
        documentId: jdDocumentId,
        sourceKind: jdSourceKind,
        documentType: 'JOB_DESCRIPTION',
        documentChecksum: jdChecksum,
        extractorVersion: JD_EXTRACTOR_VERSION,
        schemaVersion: SCHEMA_VERSION,
        status: 'QUEUED',
        nextAttemptAt: new Date(nowMs + 1),
        maximumAttempts: env.DOCUMENT_EXTRACTION_MAX_ATTEMPTS,
      },
      session
    );

    logTelemetry('EXTRACTION_JOBS_CREATED', {
      intakeId: String(intake._id),
      runId: String(createdRun._id),
      resumeJobId: String(resumeJob._id),
      jdJobId: String(jdJob._id),
    });

    return createdRun;
  });

  return run;
};

/**
 * Reconcile submitted READY_FOR_ANALYSIS intakes that have no extraction run yet
 * (recovers any lost in-memory events on startup or periodic sweep).
 */
const reconcilePendingIntakes = async () => {
  const pendingIntakes = await InterviewIntake.find({ status: 'READY_FOR_ANALYSIS' })
    .select('_id')
    .limit(50)
    .lean();

  let enqueuedCount = 0;
  for (const intake of pendingIntakes) {
    try {
      const run = await enqueueIntakeIntelligence(intake._id);
      if (run) enqueuedCount += 1;
    } catch (err) {
      logTelemetry('RECONCILE_INTAKE_FAILED', {
        intakeId: String(intake._id),
        errorCode: err.code || 'UNKNOWN',
      });
    }
  }
  return enqueuedCount;
};

/**
 * Recompute and persist the combined IntakeIntelligenceRun status from its child jobs.
 */
const refreshRunStatus = async (runId) => {
  const jobs = await jobRepo.listJobsByRunId(runId);
  if (jobs.length === 0) return null;

  const resumeJob = jobs.find((j) => j.documentType === 'RESUME');
  const jdJob = jobs.find((j) => j.documentType === 'JOB_DESCRIPTION');

  const updates = {
    resumeExtractionId: resumeJob?.extractionId || null,
    jobDescriptionExtractionId: jdJob?.extractionId || null,
  };

  const statuses = jobs.map((j) => j.status);
  const activeStatuses = new Set(['QUEUED', 'PROCESSING', 'RETRY_WAIT']);
  const hasActive = statuses.some((s) => activeStatuses.has(s));
  const completedCount = statuses.filter((s) => s === 'COMPLETED').length;
  const reviewStatuses = new Set(['NEEDS_OCR', 'BLOCKED_SECURITY_SCAN', 'REJECTED']);
  const hasReview = statuses.some((s) => reviewStatuses.has(s));
  const hasFailed = statuses.some((s) => s === 'FAILED');

  if (hasActive) {
    updates.status = completedCount > 0 ? 'PARTIALLY_COMPLETED' : 'PROCESSING';
  } else if (completedCount === jobs.length) {
    // Check if any child extraction had warnings
    const extractions = await Promise.all(
      jobs.map((j) =>
        j.extractionId ? extractionRepo.findExtractionByIdAndUser(j.extractionId, j.userId) : null
      )
    );
    const allWarnings = extractions.flatMap((e) => e?.validationWarnings || []);
    updates.validationWarnings = [...new Set(allWarnings)];
    updates.status = allWarnings.length > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED';
    updates.completedAt = new Date();
  } else if (completedCount > 0 && (hasFailed || hasReview)) {
    updates.status = 'PARTIALLY_COMPLETED';
    updates.completedAt = new Date();
  } else if (hasReview) {
    updates.status = 'NEEDS_REVIEW';
    updates.completedAt = new Date();
  } else {
    updates.status = 'FAILED';
    updates.completedAt = new Date();
  }

  updates.completionSummary = {
    resumeStatus: resumeJob?.status || 'UNKNOWN',
    jobDescriptionStatus: jdJob?.status || 'UNKNOWN',
  };

  return extractionRepo.updateRun(runId, updates);
};

/**
 * Determine whether an error is retryable or terminal.
 */
const classifyJobFailure = (err) => {
  if (err instanceof LlmProviderError) {
    if (err.category === 'AUTH_ERROR') return { retryable: false, terminalStatus: 'FAILED', code: 'LLM_AUTH_ERROR' };
    return { retryable: true, code: `LLM_${err.category}` };
  }
  const code = err?.code || 'INTERNAL_ERROR';
  if (
    [
      'CORRUPTED_DOCUMENT',
      'ENCRYPTED_DOCUMENT',
      'UNSUPPORTED_DOCUMENT_TYPE',
      'EMPTY_DOCUMENT',
      'DOCUMENT_PAGE_LIMIT_EXCEEDED',
      'ZIP_EXPANSION_LIMIT_EXCEEDED',
    ].includes(code)
  ) {
    return { retryable: false, terminalStatus: 'REJECTED', code };
  }
  if (code === 'BLOCKED_SECURITY_SCAN') {
    return { retryable: false, terminalStatus: 'BLOCKED_SECURITY_SCAN', code };
  }
  if (code === 'EXTRACTION_SCHEMA_INVALID' || code === 'PARSE_TIMEOUT') {
    return { retryable: true, code };
  }
  return { retryable: true, code };
};

/**
 * Intake-level document security gate enforced for BOTH RESUME and JOB_DESCRIPTION jobs
 * prior to cache lookup, parsing, OCR, or LLM calls. Fails closed if intake or resume
 * metadata is missing, quarantined, or unscanned when unscanned extraction is disabled.
 */
const verifyIntakeDocumentSecurityGate = async (job) => {
  const intake = await InterviewIntake.findOne({
    _id: job.intakeId,
    userId: job.userId,
  })
    .select('resumeDocumentId')
    .lean();

  if (!intake || !intake.resumeDocumentId) {
    throw new AppError(
      403,
      'Document processing blocked: resume document metadata missing or unverifiable',
      'BLOCKED_SECURITY_SCAN'
    );
  }

  const resumeDoc = await CandidateDocument.findOne({
    _id: intake.resumeDocumentId,
    userId: job.userId,
    documentType: 'RESUME',
    uploadStatus: 'VALIDATED',
  })
    .select('securityStatus')
    .lean();

  if (!resumeDoc) {
    throw new AppError(
      403,
      'Document processing blocked: resume document metadata missing or unverifiable',
      'BLOCKED_SECURITY_SCAN'
    );
  }

  if (resumeDoc.securityStatus === 'QUARANTINED') {
    throw new AppError(
      403,
      'Document processing blocked: resume failed malware scan (quarantined)',
      'BLOCKED_SECURITY_SCAN'
    );
  }

  if (
    resumeDoc.securityStatus !== 'MALWARE_SCANNED_CLEAN' &&
    !env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED
  ) {
    throw new AppError(
      403,
      'Document processing blocked: malware scan required by security policy',
      'BLOCKED_SECURITY_SCAN'
    );
  }

  if (job.sourceKind === 'DOCUMENT' && String(job.documentId) !== String(intake.resumeDocumentId)) {
    const jobDoc = await CandidateDocument.findOne({
      _id: job.documentId,
      userId: job.userId,
      documentType: job.documentType,
      uploadStatus: 'VALIDATED',
    })
      .select('securityStatus')
      .lean();

    if (!jobDoc) {
      throw new AppError(
        403,
        'Document processing blocked: target document metadata missing or unverifiable',
        'BLOCKED_SECURITY_SCAN'
      );
    }

    if (jobDoc.securityStatus === 'QUARANTINED') {
      throw new AppError(
        403,
        'Document processing blocked: document failed malware scan (quarantined)',
        'BLOCKED_SECURITY_SCAN'
      );
    }

    if (
      jobDoc.securityStatus !== 'MALWARE_SCANNED_CLEAN' &&
      !env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED
    ) {
      throw new AppError(
        403,
        'Document processing blocked: malware scan required by security policy',
        'BLOCKED_SECURITY_SCAN'
      );
    }
  }
};

/**
 * Process a single claimed DocumentExtractionJob end-to-end.
 */
const processExtractionJob = async (
  job,
  { llmProvider = new GeminiExtractionProvider(), workerId = 'worker', signal = undefined, isLeaseLost = null } = {}
) => {
  const startedAt = new Date();
  const leaseToken = job.leaseToken || null;
  const checkLeaseLost = () => Boolean(isLeaseLost?.() || signal?.aborted);

  if (checkLeaseLost()) {
    return { status: 'LEASE_LOST', fenced: true };
  }

  logTelemetry('EXTRACTION_JOB_STARTED', {
    jobId: String(job._id),
    intakeId: String(job.intakeId),
    documentId: job.documentId,
    documentType: job.documentType,
    attempt: job.attemptCount,
    workerId,
  });

  try {
    // 0. Intake-level document security gate (protects RESUME and JOB_DESCRIPTION jobs before cache/parse/LLM)
    await verifyIntakeDocumentSecurityGate(job);
    if (checkLeaseLost()) return { status: 'LEASE_LOST', fenced: true };

    // 0b. Terminal-state protection (supports idempotent cache reads on COMPLETED without mutating terminal state)
    if (extractionStateMachine.isTerminal(job.status)) {
      if (job.status === 'COMPLETED') {
        const cachedTerminal = await extractionRepo.findExtractionByIdempotency({
          documentId: job.documentId,
          documentChecksum: job.documentChecksum,
          extractorVersion: job.extractorVersion,
          schemaVersion: job.schemaVersion,
        });
        return {
          status: 'COMPLETED',
          cached: true,
          extractionId: cachedTerminal?._id || job.extractionId || null,
        };
      }
      return {
        status: job.status,
        terminal: true,
        errorCode: job.lastErrorCode || job.status,
      };
    }

    await extractionRepo.updateRun(job.runId, { status: 'PROCESSING', startedAt });

    // 1. Check idempotent extraction cache first
    const cached = await extractionRepo.findExtractionByIdempotency({
      documentId: job.documentId,
      documentChecksum: job.documentChecksum,
      extractorVersion: job.extractorVersion,
      schemaVersion: job.schemaVersion,
    });

    if (cached) {
      const updated = await jobRepo.markJobCompleted(job._id, {
        extractionId: cached._id,
        leaseToken,
      });
      if (!updated) {
        return { status: 'LEASE_LOST', fenced: true };
      }
      await refreshRunStatus(job.runId);
      logTelemetry('EXTRACTION_CACHE_HIT', {
        jobId: String(job._id),
        intakeId: String(job.intakeId),
        documentId: job.documentId,
        extractionId: String(cached._id),
      });
      return { status: 'COMPLETED', cached: true, extractionId: cached._id };
    }

    // 2. Load and parse source document (never trusting event payload)
    let parsedDoc;
    if (job.sourceKind === 'DOCUMENT') {
      const doc = await CandidateDocument.findOne({
        _id: job.documentId,
        userId: job.userId,
        documentType: job.documentType,
        uploadStatus: 'VALIDATED',
      }).lean();

      if (!doc) {
        throw new AppError(404, 'Owned document record not found', 'DOCUMENT_NOT_FOUND');
      }

      // Security policy check for unscanned documents
      if (doc.securityStatus !== 'MALWARE_SCANNED_CLEAN' && !env.DOCUMENT_EXTRACTION_ALLOW_UNSCANNED) {
        throw new AppError(
          403,
          'Document processing blocked: malware scan required by security policy',
          'BLOCKED_SECURITY_SCAN'
        );
      }

      const stream = await getStorageAdapter().getReadStream(doc.storageKey);
      const buffer = await streamToBuffer(stream);
      parsedDoc = await parseDocument({
        documentId: String(doc._id),
        documentType: doc.documentType,
        mimeType: doc.mimeType,
        buffer,
      });
    } else {
      const intake = await InterviewIntake.findOne({ _id: job.intakeId, userId: job.userId }).lean();
      if (!intake) {
        throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
      }
      const targetJob = await TargetJobProfile.findOne({
        _id: intake.targetJobProfileId,
        userId: job.userId,
      }).lean();
      if (!targetJob || !targetJob.jobDescriptionText) {
        throw new AppError(404, 'Job description text not found', 'JOB_DESCRIPTION_REQUIRED');
      }
      parsedDoc = parsePlainTextDocument({
        documentId: job.documentId,
        documentType: 'JOB_DESCRIPTION',
        text: targetJob.jobDescriptionText,
      });
    }

    // 3. Handle scanned / image-only PDFs explicitly without fabricating data
    if (checkLeaseLost()) return { status: 'LEASE_LOST', fenced: true };
    if (parsedDoc.status === 'OCR_REQUIRED') {
      const ocrExtraction = await extractionRepo.upsertExtraction(
        {
          documentId: job.documentId,
          documentChecksum: job.documentChecksum,
          extractorVersion: job.extractorVersion,
          schemaVersion: job.schemaVersion,
        },
        {
          documentId: job.documentId,
          candidateProfileId: job.candidateProfileId,
          userId: job.userId,
          documentChecksum: job.documentChecksum,
          documentType: job.documentType,
          parserVersion: PARSER_VERSION,
          extractorVersion: job.extractorVersion,
          promptVersion: 'N/A',
          schemaVersion: job.schemaVersion,
          extractionStatus: 'OCR_REQUIRED',
          extractedData: null,
          validationWarnings: [parsedDoc.reason || 'NO_EXTRACTABLE_TEXT'],
          parserMetadata: parsedDoc.metadata,
          startedAt,
          completedAt: new Date(),
        }
      );

      const updatedOcr = await jobRepo.markJobTerminal(job._id, {
        status: 'NEEDS_OCR',
        errorCode: 'OCR_REQUIRED',
        errorMessage: 'Document contains no extractable text; OCR required',
        leaseToken,
      });
      if (!updatedOcr) {
        return { status: 'LEASE_LOST', fenced: true };
      }
      await refreshRunStatus(job.runId);
      logTelemetry('EXTRACTION_OCR_REQUIRED', {
        jobId: String(job._id),
        intakeId: String(job.intakeId),
        documentId: job.documentId,
        extractionId: String(ocrExtraction._id),
      });
      return { status: 'NEEDS_OCR', extractionId: ocrExtraction._id };
    }

    // 4. Run LLM extraction + Zod + EvidenceValidator
    if (checkLeaseLost()) return { status: 'LEASE_LOST', fenced: true };
    const result =
      job.documentType === 'RESUME'
        ? await extractResumeIntelligence({
            parsedDoc,
            llmProvider,
            requestId: String(job._id),
            signal,
          })
        : await extractJdIntelligence({
            parsedDoc,
            llmProvider,
            requestId: String(job._id),
            signal,
          });

    if (checkLeaseLost()) return { status: 'LEASE_LOST', fenced: true };

    const completedAt = new Date();
    const savedExtraction = await extractionRepo.upsertExtraction(
      {
        documentId: job.documentId,
        documentChecksum: job.documentChecksum,
        extractorVersion: job.extractorVersion,
        schemaVersion: job.schemaVersion,
      },
      {
        documentId: job.documentId,
        candidateProfileId: job.candidateProfileId,
        userId: job.userId,
        documentChecksum: job.documentChecksum,
        documentType: job.documentType,
        parserVersion: PARSER_VERSION,
        extractorVersion: result.metadata.extractorVersion,
        promptVersion: result.metadata.promptVersion,
        schemaVersion: result.metadata.schemaVersion,
        provider: result.metadata.provider,
        model: result.metadata.model,
        extractionStatus: result.extraction.extractionStatus,
        extractedData: result.extraction,
        validationWarnings: result.extraction.validationWarnings || [],
        parserMetadata: parsedDoc.metadata,
        tokenUsage: result.metadata.totalTokens || 0,
        startedAt,
        completedAt,
      }
    );

    const completedJob = await jobRepo.markJobCompleted(job._id, {
      extractionId: savedExtraction._id,
      leaseToken,
    });
    if (!completedJob) {
      return { status: 'LEASE_LOST', fenced: true };
    }
    await refreshRunStatus(job.runId);

    logTelemetry('EXTRACTION_COMPLETED', {
      jobId: String(job._id),
      intakeId: String(job.intakeId),
      documentId: job.documentId,
      extractionId: String(savedExtraction._id),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      pageCount: parsedDoc.metadata.pageCount,
      totalCharacters: parsedDoc.metadata.totalCharacters,
      tokenUsage: result.metadata.totalTokens || 0,
      warningCount: (result.extraction.validationWarnings || []).length,
    });

    return { status: 'COMPLETED', cached: false, extractionId: savedExtraction._id };
  } catch (err) {
    if (checkLeaseLost() || err?.code === 'LEASE_LOST') {
      return { status: 'LEASE_LOST', fenced: true };
    }
    const classification = classifyJobFailure(err);

    const canRetry = extractionStateMachine.canRetryAutomatically({
      attemptCount: job.attemptCount,
      maximumAttempts: job.maximumAttempts,
      retryable: classification.retryable,
    });

    if (!canRetry) {
      const terminalStatus = classification.terminalStatus || 'FAILED';
      const updatedTerminal = await jobRepo.markJobTerminal(job._id, {
        status: terminalStatus,
        errorCode: classification.code,
        errorMessage: err?.message || 'Extraction failed',
        leaseToken,
      });
      if (!updatedTerminal) {
        return { status: 'LEASE_LOST', fenced: true };
      }
      await refreshRunStatus(job.runId);
      logTelemetry('EXTRACTION_FAILED', {
        jobId: String(job._id),
        intakeId: String(job.intakeId),
        documentId: job.documentId,
        terminalStatus,
        errorCode: classification.code,
        attempt: job.attemptCount,
      });
      return { status: terminalStatus, errorCode: classification.code };
    }

    const backoffMs = extractionStateMachine.computeRetryDelayMs({
      attemptCount: job.attemptCount,
      baseDelayMs: env.DOCUMENT_EXTRACTION_RETRY_DELAY_MS,
    });
    const nextAttemptAt = new Date(Date.now() + backoffMs);
    const updatedRetry = await jobRepo.markJobRetryWait(job._id, {
      nextAttemptAt,
      errorCode: classification.code,
      errorMessage: err?.message || 'Transient extraction failure',
      leaseToken,
    });
    if (!updatedRetry) {
      return { status: 'LEASE_LOST', fenced: true };
    }
    await refreshRunStatus(job.runId);

    logTelemetry('EXTRACTION_RETRY_SCHEDULED', {
      jobId: String(job._id),
      intakeId: String(job.intakeId),
      documentId: job.documentId,
      errorCode: classification.code,
      attempt: job.attemptCount,
      nextAttemptAt: nextAttemptAt.toISOString(),
    });
    return { status: 'RETRY_WAIT', errorCode: classification.code };
  }
};

module.exports = {
  enqueueIntakeIntelligence,
  reconcilePendingIntakes,
  processExtractionJob,
  refreshRunStatus,
};
