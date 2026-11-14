const mongoose = require('mongoose');

/**
 * Execute a callback inside a MongoDB transaction when supported (replica set / mongos).
 * If the connected MongoDB server is a standalone instance without replica set support,
 * falls back to executing without a transaction session so local dev still works.
 *
 * @param {(session: import('mongoose').ClientSession | null) => Promise<T>} work
 * @returns {Promise<T>}
 */
const withTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    // Fallback for standalone MongoDB instances that do not support multi-doc transactions
    const msg = err?.message || '';
    if (
      msg.includes('Transaction numbers are only allowed on a replica set member') ||
      msg.includes('sessions are not supported')
    ) {
      return work(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

module.exports = { withTransaction };
