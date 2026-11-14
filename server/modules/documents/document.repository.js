const { CandidateDocument } = require('./candidateDocument.model');

const createDocument = async (docData, session = null) => {
  const [created] = await CandidateDocument.create([docData], session ? { session } : {});
  return created;
};

const findByIdAndUser = async (documentId, userId, session = null) => {
  const query = CandidateDocument.findOne({ _id: documentId, userId, uploadStatus: { $ne: 'DELETED' } });
  if (session) query.session(session);
  return query.exec();
};

const findByChecksum = async ({ candidateProfileId, documentType, checksum }, session = null) => {
  const query = CandidateDocument.findOne({
    candidateProfileId,
    documentType,
    checksum,
    uploadStatus: 'VALIDATED',
  });
  if (session) query.session(session);
  return query.exec();
};

const listByCandidateProfile = async (candidateProfileId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    CandidateDocument.find({ candidateProfileId, uploadStatus: { $ne: 'DELETED' } })
      .select('-storageKey -storedFilename')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CandidateDocument.countDocuments({ candidateProfileId, uploadStatus: { $ne: 'DELETED' } }),
  ]);
  return { items, total, page, limit };
};

const markDeleted = async (documentId, userId, session = null) => {
  return CandidateDocument.findOneAndUpdate(
    { _id: documentId, userId },
    { $set: { uploadStatus: 'DELETED' } },
    { new: true, ...(session ? { session } : {}) }
  );
};

module.exports = {
  createDocument,
  findByIdAndUser,
  findByChecksum,
  listByCandidateProfile,
  markDeleted,
};
