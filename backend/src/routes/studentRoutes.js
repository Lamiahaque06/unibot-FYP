const express = require('express');
const { studentController } = require('../controllers');
const { protect, authorize, validator } = require('../middleware');

const router = express.Router();

/**
 * Student Routes
 * All routes are protected and require student role
 */

// Apply authentication middleware to all routes
router.use(protect);
router.use(authorize('student'));

// @route   GET /api/student/dashboard
// @desc    Get student dashboard data
// @access  Private (Student)
router.get('/dashboard', studentController.getDashboard);

// @route   GET /api/student/enrollments
// @desc    Get student enrollments
// @access  Private (Student)
router.get('/enrollments', studentController.getEnrollments);

// @route   GET /api/student/enrollments/:id
// @desc    Get specific enrollment details
// @access  Private (Student)
router.get('/enrollments/:id', validator.validateObjectId, studentController.getEnrollmentDetails);

// @route   POST /api/student/enroll
// @desc    Enroll in a course
// @access  Private (Student)
router.post('/enroll', validator.validateEnrollment, studentController.enrollInCourse);

// @route   GET /api/student/fees
// @desc    Get student fees
// @access  Private (Student)
router.get('/fees', studentController.getFees);

// @route   GET /api/student/fees/:id
// @desc    Get specific fee details
// @access  Private (Student)
router.get('/fees/:id', validator.validateObjectId, studentController.getFeeDetails);

// @route   GET /api/student/schedule
// @desc    Get student course schedule
// @access  Private (Student)
router.get('/schedule', studentController.getSchedule);

module.exports = router;
