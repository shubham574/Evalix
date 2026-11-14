const { DocumentExtraction } = require('./documentExtraction.model');
const { IntakeIntelligenceRun } = require('./intakeIntelligenceRun.model');

const findExtractionByIdempotency = async ({
  documentId,
  documentChecksum,
  extractorVersion,
  schemaVersion,
}) => {
  return DocumentExtraction.findOne({
    documentId: String(documentId),
    documentChecksum,
    extractorVersion,
    schemaVersion,
  }).exec();
};

const upsertExtraction = async (filter, data, session = null) => {
  return DocumentExtraction.findOneAndUpdate(
    filter,
    { $setOnInsert: data },
    {
      upsert: true,
      new: true,
      ...(session ? { session } : {}),
    }
  ).exec();
};

const findExtractionByIdAndUser = async (extractionId, userId) =>
  DocumentExtraction.findOne({ _id: extractionId, userId }).lean();

const findRunByVersions = async ({
  intakeId,
  resumeDocumentId,
  resumeChecksum,
  jobDescriptionSourceKey,
}) => {
  return IntakeIntelligenceRun.findOne({
    intakeId,
    resumeDocumentId,
    resumeChecksum,
    jobDescriptionSourceKey,
  }).exec();
};

const findLatestRunByIntakeAndUser = async (intakeId, userId) => {
  return IntakeIntelligenceRun.findOne({ intakeId, userId })
    .sort({ createdAt: -1 })
    .populate('resumeExtractionId')
    .populate('jobDescriptionExtractionId')
    .lean();
};

const createRunIdempotent = async (data, session = null) => {
  const {
    intakeId,
    resumeDocumentId,
    resumeChecksum,
    jobDescriptionSourceKey,
  } = data;

  return IntakeIntelligenceRun.findOneAndUpdate(
    { intakeId, resumeDocumentId, resumeChecksum, jobDescriptionSourceKey },
    { $setOnInsert: data },
    {
      upsert: true,
      new: true,
      ...(session ? { session } : {}),
    }
  ).exec();
};

const updateRun = async (runId, updates) => {
  return IntakeIntelligenceRun.findByIdAndUpdate(
    runId,
    { $set: updates },
    { new: true }
  ).exec();
};

module.exports = {
  findExtractionByIdempotency,
  upsertExtraction,
  findExtractionByIdAndUser,
  findRunByVersions,
  findLatestRunByIntakeAndUser,
  createRunIdempotent,
  updateRun,
};
