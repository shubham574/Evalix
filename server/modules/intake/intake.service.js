const AppError = require('../common/errors/AppError');
const { withTransaction } = require('../common/db/transaction');
const { emitIntakeSubmitted } = require('../common/events/intakeEvents');
const { requireCandidateProfile } = require('../candidate/candidate.service');
const jobProfileRepo = require('../job-profile/jobProfile.repository');
const documentRepo = require('../documents/document.repository');
const { storeCandidateDocument, toPublicDocumentDTO } = require('../documents/document.service');
const intakeRepo = require('./intake.repository');

const toTargetJobDTO = (job) => {
  if (!job) return null;
  const obj = typeof job.toObject === 'function' ? job.toObject() : job;
  return {
    id: String(obj._id),
    targetRole: obj.targetRole,
    targetCompany: obj.targetCompany,
    experienceRequired: obj.experienceRequired,
    jobDescriptionText: obj.jobDescriptionText,
    jobDescriptionDocument:
      obj.jobDescriptionDocumentId && typeof obj.jobDescriptionDocumentId === 'object' && obj.jobDescriptionDocumentId._id
        ? toPublicDocumentDTO(obj.jobDescriptionDocumentId)
        : null,
    jobDescriptionDocumentId: obj.jobDescriptionDocumentId
      ? String(obj.jobDescriptionDocumentId._id || obj.jobDescriptionDocumentId)
      : null,
    jobLocation: obj.jobLocation,
    jobType: obj.jobType,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

const toIntakeDTO = (intake) => ({
  id: String(intake._id),
  intakeId: String(intake._id),
  candidateProfileId: String(intake.candidateProfileId),
  targetJobProfileId: String(intake.targetJobProfileId?._id || intake.targetJobProfileId),
  resumeDocumentId: intake.resumeDocumentId
    ? String(intake.resumeDocumentId._id || intake.resumeDocumentId)
    : null,
  status: intake.status,
  version: intake.version,
  parentIntakeId: intake.parentIntakeId ? String(intake.parentIntakeId) : null,
  interviewPreferences: intake.interviewPreferences,
  submittedAt: intake.submittedAt,
  targetJob:
    intake.targetJobProfileId && typeof intake.targetJobProfileId === 'object' && intake.targetJobProfileId._id
      ? toTargetJobDTO(intake.targetJobProfileId)
      : undefined,
  resumeDocument:
    intake.resumeDocumentId && typeof intake.resumeDocumentId === 'object' && intake.resumeDocumentId._id
      ? toPublicDocumentDTO(intake.resumeDocumentId)
      : undefined,
  createdAt: intake.createdAt,
  updatedAt: intake.updatedAt,
});

/**
 * Create a new DRAFT interview intake along with its TargetJobProfile inside a transaction.
 */
const createInterviewIntake = async (userId, payload) => {
  const profile = await requireCandidateProfile(userId);
  const { targetJob, interviewPreferences } = payload;

  const created = await withTransaction(async (session) => {
    const jobProfile = await jobProfileRepo.createTargetJobProfile(
      {
        candidateProfileId: profile._id,
        userId,
        targetRole: targetJob.role,
        targetCompany: targetJob.company ?? null,
        experienceRequired: targetJob.experienceRequired ?? null,
        jobDescriptionText: targetJob.jobDescription ?? '',
        jobLocation: targetJob.jobLocation ?? null,
        jobType: targetJob.jobType ?? null,
      },
      session
    );

    const intake = await intakeRepo.createIntake(
      {
        candidateProfileId: profile._id,
        userId,
        targetJobProfileId: jobProfile._id,
        interviewPreferences,
        status: 'DRAFT',
        version: 1,
      },
      session
    );

    return { intake, jobProfile };
  });

  return {
    intakeId: String(created.intake._id),
    status: created.intake.status,
    version: created.intake.version,
    targetJobProfileId: String(created.jobProfile._id),
    interviewPreferences: created.intake.interviewPreferences,
    createdAt: created.intake.createdAt,
  };
};

/**
 * Upload and attach a resume document to a DRAFT intake.
 */
const uploadIntakeResume = async (userId, intakeId, file) => {
  const intake = await intakeRepo.findByIdAndUser(intakeId, userId);
  if (!intake) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }
  if (intake.status !== 'DRAFT') {
    throw new AppError(
      409,
      'Cannot modify resume after intake has been submitted. Create a new revision instead.',
      'INTAKE_ALREADY_SUBMITTED'
    );
  }

  return withTransaction(async (session) => {
    const { document, deduplicated } = await storeCandidateDocument({
      candidateProfileId: intake.candidateProfileId,
      userId,
      documentType: 'RESUME',
      file,
      session,
    });

    await intakeRepo.updateByIdAndUser(
      intake._id,
      userId,
      { resumeDocumentId: document._id },
      null,
      session
    );

    return {
      intakeId: String(intake._id),
      deduplicated,
      document: toPublicDocumentDTO(document),
    };
  });
};

/**
 * Upload and attach a job description document to a DRAFT intake's TargetJobProfile.
 */
const uploadIntakeJobDescription = async (userId, intakeId, file) => {
  const intake = await intakeRepo.findByIdAndUser(intakeId, userId);
  if (!intake) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }
  if (intake.status !== 'DRAFT') {
    throw new AppError(
      409,
      'Cannot modify job description after intake has been submitted. Create a new revision instead.',
      'INTAKE_ALREADY_SUBMITTED'
    );
  }

  return withTransaction(async (session) => {
    const { document, deduplicated } = await storeCandidateDocument({
      candidateProfileId: intake.candidateProfileId,
      userId,
      documentType: 'JOB_DESCRIPTION',
      file,
      session,
    });

    await jobProfileRepo.updateByIdAndUser(
      intake.targetJobProfileId,
      userId,
      { jobDescriptionDocumentId: document._id },
      session
    );

    return {
      intakeId: String(intake._id),
      targetJobProfileId: String(intake.targetJobProfileId),
      deduplicated,
      document: toPublicDocumentDTO(document),
    };
  });
};

/**
 * Retrieve a single intake owned by the authenticated candidate.
 */
const getInterviewIntake = async (userId, intakeId) => {
  const intake = await intakeRepo.findDetailedByIdAndUser(intakeId, userId);
  if (!intake) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }
  return toIntakeDTO(intake);
};

/**
 * List paginated intakes for the authenticated candidate.
 */
const listInterviewIntakes = async (userId, query) => {
  const result = await intakeRepo.listByUser(userId, query);
  return {
    items: result.items.map(toIntakeDTO),
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit) || 1,
    },
  };
};

/**
 * Update a DRAFT intake and/or its TargetJobProfile inside a transaction.
 * Enforces explicit immutability of submitted intakes.
 */
const updateInterviewIntake = async (userId, intakeId, payload) => {
  const existing = await intakeRepo.findByIdAndUser(intakeId, userId);
  if (!existing) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }

  if (existing.status !== 'DRAFT') {
    throw new AppError(
      409,
      'Submitted or archived intakes cannot be overwritten directly. Create a revision instead.',
      'INTAKE_ALREADY_SUBMITTED'
    );
  }

  const { targetJob, interviewPreferences, expectedVersion } = payload;

  await withTransaction(async (session) => {
    if (targetJob) {
      const jobUpdates = {};
      if (targetJob.role !== undefined) jobUpdates.targetRole = targetJob.role;
      if (targetJob.company !== undefined) jobUpdates.targetCompany = targetJob.company;
      if (targetJob.experienceRequired !== undefined)
        jobUpdates.experienceRequired = targetJob.experienceRequired;
      if (targetJob.jobDescription !== undefined)
        jobUpdates.jobDescriptionText = targetJob.jobDescription;
      if (targetJob.jobLocation !== undefined) jobUpdates.jobLocation = targetJob.jobLocation;
      if (targetJob.jobType !== undefined) jobUpdates.jobType = targetJob.jobType;

      if (Object.keys(jobUpdates).length > 0) {
        await jobProfileRepo.updateByIdAndUser(
          existing.targetJobProfileId,
          userId,
          jobUpdates,
          session
        );
      }
    }

    const intakeUpdates = {};
    if (interviewPreferences) {
      intakeUpdates.interviewPreferences = {
        ...existing.interviewPreferences?.toObject?.(),
        ...existing.interviewPreferences,
        ...interviewPreferences,
      };
    }

    const updated = await intakeRepo.updateByIdAndUser(
      intakeId,
      userId,
      intakeUpdates,
      expectedVersion ?? null,
      session
    );

    if (!updated) {
      throw new AppError(
        409,
        'Interview intake was modified concurrently. Please refresh and retry.',
        'CONCURRENT_MODIFICATION'
      );
    }
  });

  return getInterviewIntake(userId, intakeId);
};

/**
 * Create a new DRAFT revision from an existing submitted/archived intake
 * without overwriting the historical submission.
 */
const createIntakeRevision = async (userId, intakeId) => {
  const original = await intakeRepo.findByIdAndUser(intakeId, userId);
  if (!original) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }

  const originalJob = await jobProfileRepo.findByIdAndUser(original.targetJobProfileId, userId);
  if (!originalJob) {
    throw new AppError(404, 'Target job profile not found', 'TARGET_JOB_NOT_FOUND');
  }

  const revision = await withTransaction(async (session) => {
    const clonedJob = await jobProfileRepo.createTargetJobProfile(
      {
        candidateProfileId: original.candidateProfileId,
        userId,
        targetRole: originalJob.targetRole,
        targetCompany: originalJob.targetCompany,
        experienceRequired: originalJob.experienceRequired,
        jobDescriptionText: originalJob.jobDescriptionText,
        jobDescriptionDocumentId: originalJob.jobDescriptionDocumentId,
        jobLocation: originalJob.jobLocation,
        jobType: originalJob.jobType,
      },
      session
    );

    return intakeRepo.createIntake(
      {
        candidateProfileId: original.candidateProfileId,
        userId,
        targetJobProfileId: clonedJob._id,
        resumeDocumentId: original.resumeDocumentId,
        interviewPreferences: original.interviewPreferences,
        status: 'DRAFT',
        version: original.version + 1,
        parentIntakeId: original._id,
      },
      session
    );
  });

  return getInterviewIntake(userId, revision._id);
};

/**
 * Validate completeness and transition a DRAFT intake to READY_FOR_ANALYSIS,
 * emitting the Module 1 -> Module 2 integration event.
 */
const submitInterviewIntake = async (userId, intakeId) => {
  const profile = await requireCandidateProfile(userId);
  const intake = await intakeRepo.findByIdAndUser(intakeId, userId);

  if (!intake) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }

  if (intake.status !== 'DRAFT') {
    throw new AppError(
      409,
      `Cannot submit intake from status ${intake.status}`,
      'INVALID_STATE_TRANSITION'
    );
  }

  if (!intake.resumeDocumentId) {
    throw new AppError(
      400,
      'A validated resume document is required before submitting the intake',
      'RESUME_REQUIRED'
    );
  }

  const resumeDoc = await documentRepo.findByIdAndUser(intake.resumeDocumentId, userId);
  if (!resumeDoc || resumeDoc.uploadStatus !== 'VALIDATED') {
    throw new AppError(
      400,
      'Resume document is missing or has not passed upload validation',
      'INVALID_RESUME_DOCUMENT'
    );
  }

  const targetJob = await jobProfileRepo.findByIdAndUser(intake.targetJobProfileId, userId);
  if (!targetJob || !targetJob.targetRole || targetJob.targetRole.trim().length < 2) {
    throw new AppError(400, 'Target job role is required before submission', 'TARGET_ROLE_REQUIRED');
  }

  const hasJdText = Boolean(targetJob.jobDescriptionText && targetJob.jobDescriptionText.trim().length >= 20);
  let jdDoc = null;
  if (targetJob.jobDescriptionDocumentId) {
    jdDoc = await documentRepo.findByIdAndUser(targetJob.jobDescriptionDocumentId, userId);
  }
  const hasJdDoc = Boolean(jdDoc && jdDoc.uploadStatus === 'VALIDATED');

  if (!hasJdText && !hasJdDoc) {
    throw new AppError(
      400,
      'Provide either a job description text (at least 20 characters) or a validated job description document',
      'JOB_DESCRIPTION_REQUIRED'
    );
  }

  const submittedAt = new Date();
  const eventPayload = {
    event: 'INTERVIEW_INTAKE_SUBMITTED',
    intakeId: String(intake._id),
    candidateProfileId: String(profile._id),
    resumeDocumentId: String(resumeDoc._id),
    targetJobProfileId: String(targetJob._id),
    jobDescriptionDocumentId: jdDoc ? String(jdDoc._id) : null,
    submittedAt: submittedAt.toISOString(),
  };

  const updated = await intakeRepo.updateByIdAndUser(
    intake._id,
    userId,
    {
      status: 'READY_FOR_ANALYSIS',
      submittedAt,
      analysisEventPayload: eventPayload,
    },
    intake.version
  );

  if (!updated) {
    throw new AppError(
      409,
      'Interview intake was modified concurrently. Please refresh and retry.',
      'CONCURRENT_MODIFICATION'
    );
  }

  // Emit event AFTER intake is updated to READY_FOR_ANALYSIS in DB
  emitIntakeSubmitted({
    intakeId: intake._id,
    candidateProfileId: profile._id,
    resumeDocumentId: resumeDoc._id,
    targetJobProfileId: targetJob._id,
    jobDescriptionDocumentId: jdDoc ? jdDoc._id : null,
    submittedAt,
  });

  return {
    intakeId: String(updated._id),
    status: updated.status,
    submittedAt: updated.submittedAt,
    version: updated.version,
    integrationEvent: eventPayload,
  };
};

module.exports = {
  createInterviewIntake,
  uploadIntakeResume,
  uploadIntakeJobDescription,
  getInterviewIntake,
  listInterviewIntakes,
  updateInterviewIntake,
  createIntakeRevision,
  submitInterviewIntake,
};
