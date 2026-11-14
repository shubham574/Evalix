const mongoose = require('mongoose');
const AppError = require('../errors/AppError');

/**
 * Express middleware factory to validate req.body / req.params / req.query with Zod.
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || source,
      message: issue.message,
    }));
    const firstMsg = details[0]
      ? `${details[0].field}: ${details[0].message}`
      : 'Invalid request payload';
    return next(new AppError(400, firstMsg, 'VALIDATION_ERROR', details));
  }
  req[source] = result.data;
  return next();
};

/**
 * Validate a MongoDB ObjectId parameter.
 */
const validateObjectIdParam = (paramName) => (req, res, next) => {
  const value = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return next(new AppError(400, `Invalid ${paramName} identifier`, 'INVALID_IDENTIFIER'));
  }
  return next();
};

module.exports = {
  validate,
  validateObjectIdParam,
};
