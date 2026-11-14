const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console for dev
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new ApiError(404, message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ApiError(400, message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new ApiError(400, message);
  }

  // Mongoose buffering timeout (DB not connected)
  if (err.name === 'MongooseError' && err.message.includes('buffering timed out')) {
    const message = 'Database is temporarily unavailable. Please try again in a moment.';
    error = new ApiError(503, message);
  }

  // MongoDB server errors (connection refused, etc.)
  if (err.name === 'MongoServerError' || err.name === 'MongoNetworkError') {
    const message = 'Database connection error. Please try again in a moment.';
    error = new ApiError(503, message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Not authorized to access this route';
    error = new ApiError(401, message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Session expired, please login again';
    error = new ApiError(401, message);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    error: error.message || 'Server Error',
    ...(err.code && typeof err.code === 'string' && { code: err.code }),
    ...(err.details && { details: err.details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
