/**
 * Middleware Index
 * Central export point for all middleware
 */

const { protect, authorize, optionalAuth } = require('./auth');
const { AppError, errorHandler, asyncHandler, notFound } = require('./errorHandler');
const { apiLimiter, authLimiter, chatLimiter } = require('./rateLimiter');
const validator = require('./validator');

module.exports = {
  // Auth middleware
  protect,
  authorize,
  optionalAuth,

  // Error handling
  AppError,
  errorHandler,
  asyncHandler,
  notFound,

  // Rate limiting
  apiLimiter,
  authLimiter,
  chatLimiter,

  // Validation
  validator,
};
