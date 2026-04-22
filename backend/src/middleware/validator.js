const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation Middleware
 * Provides validation rules and handler for request validation
 */

/**
 * Handle validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * User registration validation
 */
const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('role')
    .optional()
    .isIn(['student', 'admin'])
    .withMessage('Role must be either student or admin'),
  validate,
];

/**
 * User login validation
 */
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate,
];

/**
 * Course creation validation
 */
const validateCourse = [
  body('courseCode')
    .trim()
    .notEmpty()
    .withMessage('Course code is required')
    .toUpperCase(),
  body('courseName')
    .trim()
    .notEmpty()
    .withMessage('Course name is required'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  body('credits')
    .isInt({ min: 1, max: 6 })
    .withMessage('Credits must be between 1 and 6'),
  body('department')
    .trim()
    .notEmpty()
    .withMessage('Department is required'),
  validate,
];

/**
 * Enrollment validation
 */
const validateEnrollment = [
  body('courseId')
    .isMongoId()
    .withMessage('Invalid course ID'),
  validate,
];

/**
 * Fee validation
 */
const validateFee = [
  body('studentId')
    .isMongoId()
    .withMessage('Invalid student ID'),
  body('feeType')
    .isIn(['tuition', 'hostel', 'library', 'laboratory', 'examination', 'registration', 'other'])
    .withMessage('Invalid fee type'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('dueDate')
    .isISO8601()
    .withMessage('Invalid due date'),
  validate,
];

/**
 * Message validation
 */
const validateMessage = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters'),
  validate,
];

/**
 * ObjectId parameter validation
 */
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  validate,
];

/**
 * Pagination validation
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate,
];

module.exports = {
  validate,
  validateRegister,
  validateLogin,
  validateCourse,
  validateEnrollment,
  validateFee,
  validateMessage,
  validateObjectId,
  validatePagination,
};
