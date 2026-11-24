const { TargetJobProfile } = require('./targetJobProfile.model');

const createTargetJobProfile = async (data, session = null) => {
  const [created] = await TargetJobProfile.create([data], session ? { session } : {});
  return created;
};

const findByIdAndUser = async (id, userId, session = null) => {
  const query = TargetJobProfile.findOne({ _id: id, userId });
  if (session) query.session(session);
  return query.exec();
};

const updateByIdAndUser = async (id, userId, updates, session = null) => {
  return TargetJobProfile.findOneAndUpdate(
    { _id: id, userId },
    { $set: updates },
    {
      returnDocument: 'after',
      runValidators: true,
      ...(session ? { session } : {}),
    }
  );
};

module.exports = {
  createTargetJobProfile,
  findByIdAndUser,
  updateByIdAndUser,
};
