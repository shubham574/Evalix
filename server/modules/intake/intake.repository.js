const { InterviewIntake } = require('./interviewIntake.model');

const createIntake = async (data, session = null) => {
  const [created] = await InterviewIntake.create([data], session ? { session } : {});
  return created;
};

const findByIdAndUser = async (intakeId, userId, session = null) => {
  const query = InterviewIntake.findOne({ _id: intakeId, userId });
  if (session) query.session(session);
  return query.exec();
};

const findDetailedByIdAndUser = async (intakeId, userId) => {
  return InterviewIntake.findOne({ _id: intakeId, userId })
    .populate({
      path: 'targetJobProfileId',
      populate: {
        path: 'jobDescriptionDocumentId',
        select: '-storageKey -storedFilename',
      },
    })
    .populate({
      path: 'resumeDocumentId',
      select: '-storageKey -storedFilename',
    })
    .lean();
};

const listByUser = async (userId, { page = 1, limit = 10, status } = {}) => {
  const filter = { userId };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    InterviewIntake.find(filter)
      .populate('targetJobProfileId', 'targetRole targetCompany experienceRequired jobType')
      .populate('resumeDocumentId', 'originalFilename mimeType fileSize uploadStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InterviewIntake.countDocuments(filter),
  ]);

  return { items, total, page, limit };
};

const updateByIdAndUser = async (intakeId, userId, updates, expectedVersion = null, session = null) => {
  const filter = { _id: intakeId, userId };
  if (expectedVersion !== null && expectedVersion !== undefined) {
    filter.version = expectedVersion;
  }

  return InterviewIntake.findOneAndUpdate(
    filter,
    {
      $set: updates,
      $inc: { version: 1 },
    },
    {
      returnDocument: 'after',
      runValidators: true,
      ...(session ? { session } : {}),
    }
  );
};

module.exports = {
  createIntake,
  findByIdAndUser,
  findDetailedByIdAndUser,
  listByUser,
  updateByIdAndUser,
};
