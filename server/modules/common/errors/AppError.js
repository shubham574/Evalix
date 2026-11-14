const ApiError = require('../../../utils/ApiError');

/**
 * Structured operational error with machine-readable error code
 * and optional validation details, compatible with existing errorHandler.
 */
class AppError extends ApiError {
  constructor(statusCode, message, code = 'INTERNAL_ERROR', details = undefined) {
    super(statusCode, message);
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

module.exports = AppError;
