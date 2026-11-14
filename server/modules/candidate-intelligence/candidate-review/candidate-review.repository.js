const { CandidateClaimReview } = require('./candidateClaimReview.model');

const getNextReviewVersion = async (analysisId, claimId, session = null) => {
  const latest = await CandidateClaimReview.findOne({ analysisId, claimId })
    .sort({ reviewVersion: -1 })
    .select('reviewVersion')
    .session(session)
    .lean();
  return latest ? latest.reviewVersion + 1 : 1;
};

const createReviewEvent = async (doc, session = null) => {
  const [created] = await CandidateClaimReview.create([doc], { session });
  return created.toObject();
};

const listReviewsByIntakeAndUser = async (intakeId, userId, analysisId = null) => {
  const filter = { intakeId, userId };
  if (analysisId) filter.analysisId = analysisId;
  return CandidateClaimReview.find(filter).sort({ reviewedAt: -1, reviewVersion: -1 }).lean();
};

module.exports = {
  getNextReviewVersion,
  createReviewEvent,
  listReviewsByIntakeAndUser,
};
