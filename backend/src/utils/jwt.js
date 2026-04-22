const jwt = require('jsonwebtoken');
const logger = require('./logger');

/**
 * JWT Utility Functions
 * Handles token generation and verification
 */

/**
 * Generate JWT token
 * @param {Object} payload - Data to encode in token
 * @param {string} expiresIn - Token expiration time
 * @returns {string} - JWT token
 */
const generateToken = (payload, expiresIn = process.env.JWT_EXPIRE || '7d') => {
  try {
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn,
    });
    return token;
  } catch (error) {
    logger.error(`Error generating JWT token: ${error.message}`);
    throw new Error('Token generation failed');
  }
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} - Decoded token payload
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      logger.error(`Error verifying JWT token: ${error.message}`);
      throw new Error('Token verification failed');
    }
  }
};

/**
 * Generate token for user
 * @param {Object} user - User object
 * @returns {string} - JWT token
 */
const generateUserToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
  };
  return generateToken(payload);
};

/**
 * Decode token without verification (for debugging)
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error(`Error decoding JWT token: ${error.message}`);
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  generateUserToken,
  decodeToken,
};
