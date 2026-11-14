const { CandidateJobAnalysis } = require('./candidateJobAnalysis.model');
const { CandidateRequirementAssessment } = require('./candidateRequirementAssessment.model');

const findLatestAnalysisByIntakeAndUser = async (intakeId, userId) =>
  CandidateJobAnalysis.findOne({ intakeId, userId }).sort({ analysisVersion: -1 }).lean();

const findAnalysisBySourceExtractions = async ({
  intakeId,
  userId,
  resumeExtractionId,
  jobDescriptionExtractionId,
  schemaVersion = '1.0',
}) =>
  CandidateJobAnalysis.findOne({
    intakeId,
    userId,
    resumeExtractionId,
    jobDescriptionExtractionId,
    schemaVersion,
    analysisStatus: { $ne: 'SUPERSEDED' },
  })
    .sort({ analysisVersion: -1 })
    .lean();

const getNextAnalysisVersion = async (intakeId, session = null) => {
  const latest = await CandidateJobAnalysis.findOne({ intakeId })
    .sort({ analysisVersion: -1 })
    .select('analysisVersion')
    .session(session)
    .lean();
  return latest ? latest.analysisVersion + 1 : 1;
};

const supersedePreviousAnalyses = async (intakeId, excludeAnalysisId, session = null) => {
  await CandidateJobAnalysis.updateMany(
    {
      intakeId,
      _id: { $ne: excludeAnalysisId },
      analysisStatus: { $nin: ['SUPERSEDED', 'FAILED'] },
    },
    { $set: { analysisStatus: 'SUPERSEDED' } },
    { session }
  ).exec();
};

const createAnalysis = async (doc, session = null) => {
  const [created] = await CandidateJobAnalysis.create([doc], { session });
  return created.toObject();
};

const updateAnalysisById = async (analysisId, update, session = null) =>
  CandidateJobAnalysis.findByIdAndUpdate(analysisId, update, { new: true, session }).lean();

const upsertRequirementAssessments = async (analysisId, intakeId, userId, assessments, session = null) => {
  if (!assessments || assessments.length === 0) return [];
  const ops = assessments.map((item) => ({
    updateOne: {
      filter: { analysisId, requirementId: item.requirementId },
      update: {
        $set: {
          ...item,
          analysisId,
          intakeId,
          userId,
        },
      },
      upsert: true,
    },
  }));
  await CandidateRequirementAssessment.bulkWrite(ops, { session });
  return CandidateRequirementAssessment.find({ analysisId }).session(session).lean();
};

const listRequirementAssessments = async (
  analysisId,
  userId,
  { page = 1, limit = 50, requirementType = null, assessment = null } = {}
) => {
  const filter = { analysisId, userId };
  if (requirementType) filter.requirementType = requirementType;
  if (assessment) filter.assessment = assessment;

  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    CandidateRequirementAssessment.find(filter)
      .sort({ requirementType: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CandidateRequirementAssessment.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

module.exports = {
  findLatestAnalysisByIntakeAndUser,
  findAnalysisBySourceExtractions,
  getNextAnalysisVersion,
  supersedePreviousAnalyses,
  createAnalysis,
  updateAnalysisById,
  upsertRequirementAssessments,
  listRequirementAssessments,
};
