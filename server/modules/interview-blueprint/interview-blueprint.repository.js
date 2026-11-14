const { InterviewBlueprint } = require('./models/interviewBlueprint.model');

const findLatestReadyOrReviewByIntakeAndUser = async (intakeId, userId) =>
  InterviewBlueprint.findOne({
    intakeId,
    userId,
    status: { $in: ['READY', 'NEEDS_REVIEW'] },
  })
    .sort({ blueprintVersion: -1 })
    .lean();

const findLatestByIntakeAndUser = async (intakeId, userId) =>
  InterviewBlueprint.findOne({ intakeId, userId }).sort({ blueprintVersion: -1 }).lean();

const findByIdAndIntakeAndUser = async (blueprintId, intakeId, userId) =>
  InterviewBlueprint.findOne({ _id: blueprintId, intakeId, userId }).lean();

const findByIdInternal = async (blueprintId, intakeId) =>
  InterviewBlueprint.findOne({ _id: blueprintId, intakeId }).lean();

const findReusableBlueprint = async ({
  intakeId,
  userId,
  candidateAnalysisId,
  interviewType,
  totalDurationSeconds,
}) =>
  InterviewBlueprint.findOne({
    intakeId,
    userId,
    candidateAnalysisId,
    interviewType,
    totalDurationSeconds,
    status: { $in: ['READY', 'NEEDS_REVIEW'] },
  })
    .sort({ blueprintVersion: -1 })
    .lean();

const listHistoryByIntakeAndUser = async (intakeId, userId) =>
  InterviewBlueprint.find({ intakeId, userId })
    .select('blueprintVersion status interviewType targetRole seniorityLevel totalDurationSeconds sourceVersions regenerationReason isLockedForSession createdAt')
    .sort({ blueprintVersion: -1 })
    .lean();

const getNextBlueprintVersion = async (intakeId, session = null) => {
  const latest = await InterviewBlueprint.findOne({ intakeId })
    .sort({ blueprintVersion: -1 })
    .select('blueprintVersion')
    .session(session)
    .lean();
  return latest ? latest.blueprintVersion + 1 : 1;
};

const createBlueprint = async (doc, session = null) => {
  const [created] = await InterviewBlueprint.create([doc], { session });
  return created.toObject();
};

const supersedePreviousBlueprints = async (intakeId, excludeBlueprintId, session = null) => {
  await InterviewBlueprint.updateMany(
    {
      intakeId,
      _id: { $ne: excludeBlueprintId },
      status: { $in: ['READY', 'NEEDS_REVIEW'] },
      isLockedForSession: false,
    },
    { $set: { status: 'SUPERSEDED' } },
    { session }
  ).exec();
};

module.exports = {
  findLatestReadyOrReviewByIntakeAndUser,
  findLatestByIntakeAndUser,
  findByIdAndIntakeAndUser,
  findByIdInternal,
  findReusableBlueprint,
  listHistoryByIntakeAndUser,
  getNextBlueprintVersion,
  createBlueprint,
  supersedePreviousBlueprints,
};
