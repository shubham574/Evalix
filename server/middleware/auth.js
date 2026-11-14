const { getAuth } = require('@clerk/express');
const ApiError = require('../utils/ApiError');

const protect = (req, res, next) => {
  try {
    // Allow load testing / benchmark test bypass in non-production or when explicitly enabled
    if (
      (process.env.NODE_ENV !== 'production' || process.env.ENABLE_TEST_AUTH === 'true') &&
      (req.headers['x-test-user-id'] || req.headers['authorization'] === 'Bearer test-token')
    ) {
      req.auth = { userId: req.headers['x-test-user-id'] || 'test_user_loadtest' };
      return next();
    }

    const auth = getAuth(req);
    const userId = auth?.userId;

    console.log('--- AUTH DEBUG ---', {
      userId,
      isAuthenticated: auth?.isAuthenticated,
      sessionId: auth?.sessionId,
      hasAuthHeader: !!req.headers.authorization,
    });

    if (!userId) {
      return next(new ApiError(401, 'Not authorized - please sign in'));
    }

    // Attach as a plain object so Mongoose can read it correctly
    req.auth = { userId };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return next(new ApiError(401, 'Authentication failed - please sign in again'));
  }
};

module.exports = { protect };
