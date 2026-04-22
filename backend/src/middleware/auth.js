const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * Protects routes by verifying JWT tokens
 */

/**
 * Protect routes - Verify JWT token
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. No token provided.',
      });
    }

    try {
      // Verify token
      const decoded = verifyToken(token);

      // Find user by ID from token
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found. Token is invalid.',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated.',
        });
      }

      // Attach user to request object
      req.user = user;
      next();
    } catch (error) {
      logger.error(`Token verification error: ${error.message}`);
      return res.status(401).json({
        success: false,
        message: error.message || 'Not authorized to access this route',
      });
    }
  } catch (error) {
    logger.error(`Authentication middleware error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication',
    });
  }
};

/**
 * Authorize specific roles
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }

    next();
  };
};

/**
 * Optional authentication - Attach user if token is valid, but don't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await User.findById(decoded.id).select('-password');

        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Token invalid but route doesn't require auth, so continue
        logger.debug(`Optional auth token verification failed: ${error.message}`);
      }
    }

    next();
  } catch (error) {
    logger.error(`Optional auth middleware error: ${error.message}`);
    next();
  }
};

module.exports = {
  protect,
  authorize,
  optionalAuth,
};
