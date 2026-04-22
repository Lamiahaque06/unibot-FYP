const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting the number of requests from a single IP
 */

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later',
    });
  },
});

/**
 * Authentication routes rate limiter (stricter)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/register attempts per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later',
    });
  },
});

/**
 * Chatbot rate limiter
 */
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 chat messages per minute
  message: {
    success: false,
    message: 'Too many messages sent, please slow down',
  },
  handler: (req, res) => {
    logger.warn(`Chat rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'You are sending messages too quickly. Please wait a moment.',
    });
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  chatLimiter,
};
