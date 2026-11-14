const AppError = require('../../common/errors/AppError');
const { withTransaction } = require('../../common/db/transaction');
const { InterviewIntake } = require('../../intake/interviewIntake.model');
const analysisRepo = require('../analysis/analysis.repository');
const reviewRepo = require('./candidate-review.repository');

const RESULTING_SOURCE_MAP = {
  CONFIRM: 'CANDIDATE_CONFIRMED',
  CORRECT: 'CANDIDATE_CORRECTED',
  DISPUTE: 'CANDIDATE_CORRECTED',
  ADD_MISSING_INFORMATION: 'CANDIDATE_ENTERED',
  MARK_NOT_MINE: 'CANDIDATE_CORRECTED',
};

const verifyOwnedIntakeAndAnalysis = async (intakeId, userId) => {
  const intake = await InterviewIntake.findOne({ _id: intakeId, userId }).lean();
  if (!intake) {
    throw new AppError(404, 'Interview intake not found', 'INTAKE_NOT_FOUND');
  }
  const analysis = await analysisRepo.findLatestAnalysisByIntakeAndUser(intakeId, userId);
  if (!analysis) {
    throw new AppError(404, 'Candidate intelligence analysis not found', 'ANALYSIS_NOT_FOUND');
  }
  return { intake, analysis };
};

const reviewClaim = async (userId, intakeId, claimId, payload) => {
  const { intake, analysis } = await verifyOwnedIntakeAndAnalysis(intakeId, userId);
  const facts = analysis.candidateProfileSnapshot?.facts || [];
  const existingFact = facts.find((f) => f.factId === claimId);

  if (payload.candidateAction !== 'ADD_MISSING_INFORMATION' && !existingFact) {
    throw new AppError(404, 'Candidate claim not found in analysis snapshot', 'CLAIM_NOT_FOUND');
  }

  // Prevent modifying job description items through candidate claim review
  const jdReqs = analysis.jobRequirementSnapshot?.requirements || [];
  if (jdReqs.some((r) => r.requirementId === claimId)) {
    throw new AppError(
      403,
      'Job description requirements cannot be modified via candidate claim review',
      'JD_MODIFICATION_FORBIDDEN'
    );
  }

  const resultingSourceType = RESULTING_SOURCE_MAP[payload.candidateAction];

  return withTransaction(async (session) => {
    const reviewVersion = await reviewRepo.getNextReviewVersion(analysis._id, claimId, session);
    return reviewRepo.createReviewEvent(
      {
        analysisId: analysis._id,
        intakeId: intake._id,
        candidateProfileId: intake.candidateProfileId,
        userId,
        claimId,
        sourceType: existingFact?.sourceType || 'CANDIDATE_ENTERED',
        resultingSourceType,
        originalValue: existingFact ? existingFact.value : null,
        candidateAction: payload.candidateAction,
        correctedValue: payload.correctedValue ?? null,
        explanation: payload.explanation || null,
        sourceEvidenceReferences: existingFact?.evidenceIds || [],
        reviewVersion,
        reviewedAt: new Date(),
      },
      session
    );
  });
};

const getClaimReviewHistory = async (userId, intakeId) => {
  const { analysis } = await verifyOwnedIntakeAndAnalysis(intakeId, userId);
  return reviewRepo.listReviewsByIntakeAndUser(intakeId, userId, analysis._id);
};

const completeCandidateReview = async (userId, intakeId) => {
  const { analysis } = await verifyOwnedIntakeAndAnalysis(intakeId, userId);

  if (['FAILED', 'QUEUED', 'PROCESSING'].includes(analysis.analysisStatus)) {
    throw new AppError(
      409,
      'Analysis must finish processing before completing candidate review',
      'ANALYSIS_NOT_READY_FOR_REVIEW'
    );
  }

  const reviews = await reviewRepo.listReviewsByIntakeAndUser(intakeId, userId, analysis._id);
  const latestByClaim = new Map();
  for (const r of reviews) {
    if (!latestByClaim.has(r.claimId)) {
      latestByClaim.set(r.claimId, r);
    }
  }

  const baseFacts = analysis.candidateProfileSnapshot?.facts || [];
  const reviewedFacts = baseFacts.map((fact) => {
    const rev = latestByClaim.get(fact.factId);
    if (!rev) return fact;

    if (rev.candidateAction === 'MARK_NOT_MINE' || rev.candidateAction === 'DISPUTE') {
      return {
        ...fact,
        reviewStatus: rev.candidateAction,
        reviewVersion: rev.reviewVersion,
        excludedByCandidate: true,
        reviewExplanation: rev.explanation,
      };
    }

    if (rev.candidateAction === 'CORRECT') {
      return {
        ...fact,
        originalValue: fact.value,
        value: rev.correctedValue,
        sourceType: 'CANDIDATE_CORRECTED',
        verificationStatus: 'SELF_REPORTED',
        reviewStatus: 'CORRECTED',
        reviewVersion: rev.reviewVersion,
        reviewExplanation: rev.explanation,
      };
    }

    // CONFIRM
    return {
      ...fact,
      sourceType: fact.sourceType === 'RESUME_EXTRACTED' ? 'RESUME_EXTRACTED' : 'CANDIDATE_CONFIRMED',
      confirmedByCandidate: true,
      reviewStatus: 'CONFIRMED',
      reviewVersion: rev.reviewVersion,
    };
  });

  // Append ADD_MISSING_INFORMATION entries
  for (const [claimId, rev] of latestByClaim.entries()) {
    if (rev.candidateAction === 'ADD_MISSING_INFORMATION' && !baseFacts.some((f) => f.factId === claimId)) {
      reviewedFacts.push({
        factId: claimId,
        factType: 'ADDITIONAL_INFORMATION',
        value: rev.correctedValue,
        sourceType: 'CANDIDATE_ENTERED',
        evidenceIds: [],
        verificationStatus: 'SELF_REPORTED',
        reviewStatus: 'ADDED',
        reviewVersion: rev.reviewVersion,
        reviewExplanation: rev.explanation,
      });
    }
  }

  const reviewedProfileSnapshot = {
    ...analysis.candidateProfileSnapshot,
    facts: reviewedFacts,
    reviewEventCount: reviews.length,
    reviewedAt: new Date().toISOString(),
  };

  const updated = await analysisRepo.updateAnalysisById(analysis._id, {
    $set: {
      analysisStatus: 'READY_FOR_INTERVIEW_PLANNING',
      reviewedProfileSnapshot,
      reviewedCompletedAt: new Date(),
    },
  });

  return updated;
};

module.exports = {
  reviewClaim,
  getClaimReviewHistory,
  completeCandidateReview,
};
