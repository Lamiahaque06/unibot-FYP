const { Enrollment, Fee, Course } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Student Controller
 * Handles student-specific data retrieval and operations
 */

/**
 * @desc    Get student dashboard data
 * @route   GET /api/student/dashboard
 * @access  Private (Student)
 */
const getDashboard = asyncHandler(async (req, res, next) => {
  const studentId = req.user._id;

  // Get active enrollments with course details
  const enrollments = await Enrollment.find({
    student: studentId,
    status: 'enrolled',
  })
    .populate('course')
    .sort({ createdAt: -1 });

  // Get pending and overdue fees
  const fees = await Fee.find({
    student: studentId,
    status: { $in: ['pending', 'overdue', 'partial'] },
  }).sort({ dueDate: 1 });

  // Calculate upcoming deadlines from enrollments
  const upcomingDeadlines = [];

  enrollments.forEach((enrollment) => {
    // Add upcoming assignments
    enrollment.getUpcomingAssignments().forEach((assignment) => {
      upcomingDeadlines.push({
        type: 'assignment',
        title: assignment.title,
        course: enrollment.course.courseName,
        courseCode: enrollment.course.courseCode,
        dueDate: assignment.dueDate,
      });
    });

    // Add upcoming exams
    enrollment.getUpcomingExams().forEach((exam) => {
      upcomingDeadlines.push({
        type: 'exam',
        title: exam.title,
        course: enrollment.course.courseName,
        courseCode: enrollment.course.courseCode,
        dueDate: exam.date,
      });
    });
  });

  // Add fee deadlines
  fees.forEach((fee) => {
    upcomingDeadlines.push({
      type: 'fee',
      title: fee.description,
      amount: fee.getRemainingBalance(),
      dueDate: fee.dueDate,
    });
  });

  // Sort deadlines by date
  upcomingDeadlines.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // Calculate statistics
  const totalCredits = enrollments.reduce((sum, e) => sum + e.course.credits, 0);
  const totalOutstandingFees = fees.reduce((sum, f) => sum + f.getRemainingBalance(), 0);

  res.status(200).json({
    success: true,
    data: {
      enrollments: enrollments.length,
      totalCredits,
      totalOutstandingFees,
      upcomingDeadlines: upcomingDeadlines.slice(0, 10), // Top 10 upcoming deadlines
      recentEnrollments: enrollments.slice(0, 5),
      pendingFees: fees,
    },
  });
});

/**
 * @desc    Get student enrollments
 * @route   GET /api/student/enrollments
 * @access  Private (Student)
 */
const getEnrollments = asyncHandler(async (req, res, next) => {
  const { status, semester, year } = req.query;
  const studentId = req.user._id;

  // Build query
  const query = { student: studentId };
  if (status) query.status = status;
  if (semester) query.semester = semester;
  if (year) query.year = parseInt(year);

  const enrollments = await Enrollment.find(query)
    .populate('course')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: enrollments.length,
    data: enrollments,
  });
});

/**
 * @desc    Get specific enrollment details
 * @route   GET /api/student/enrollments/:id
 * @access  Private (Student)
 */
const getEnrollmentDetails = asyncHandler(async (req, res, next) => {
  const enrollment = await Enrollment.findOne({
    _id: req.params.id,
    student: req.user._id,
  }).populate('course');

  if (!enrollment) {
    return next(new AppError('Enrollment not found', 404));
  }

  // Get progress statistics
  const progress = enrollment.getCourseProgress();

  res.status(200).json({
    success: true,
    data: {
      enrollment,
      progress,
    },
  });
});

/**
 * @desc    Enroll in a course
 * @route   POST /api/student/enroll
 * @access  Private (Student)
 */
const enrollInCourse = asyncHandler(async (req, res, next) => {
  const { courseId } = req.body;
  const studentId = req.user._id;

  // Check if course exists
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  // Check if course is active
  if (course.status !== 'active') {
    return next(new AppError('This course is not available for enrollment', 400));
  }

  // Check if course is full
  if (course.isFull()) {
    return next(new AppError('This course is full', 400));
  }

  // Check if already enrolled
  const existingEnrollment = await Enrollment.findOne({
    student: studentId,
    course: courseId,
    semester: course.semester,
    year: course.year,
    status: 'enrolled',
  });

  if (existingEnrollment) {
    return next(new AppError('You are already enrolled in this course', 400));
  }

  // Create enrollment
  const enrollment = await Enrollment.create({
    student: studentId,
    course: courseId,
    semester: course.semester,
    year: course.year,
  });

  // Update course enrollment count
  course.currentEnrollment += 1;
  await course.updateStatus();

  logger.info(`Student ${req.user.email} enrolled in course ${course.courseCode}`);

  res.status(201).json({
    success: true,
    message: 'Successfully enrolled in course',
    data: enrollment,
  });
});

/**
 * @desc    Get student fees
 * @route   GET /api/student/fees
 * @access  Private (Student)
 */
const getFees = asyncHandler(async (req, res, next) => {
  const { status, semester, year } = req.query;
  const studentId = req.user._id;

  // Build query
  const query = { student: studentId };
  if (status) query.status = status;
  if (semester) query.semester = semester;
  if (year) query.year = parseInt(year);

  const fees = await Fee.find(query).sort({ dueDate: 1 });

  // Calculate totals
  const totalAmount = fees.reduce((sum, f) => sum + f.amount, 0);
  const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
  const totalOutstanding = fees.reduce((sum, f) => sum + f.getRemainingBalance(), 0);

  res.status(200).json({
    success: true,
    count: fees.length,
    summary: {
      totalAmount,
      totalPaid,
      totalOutstanding,
    },
    data: fees,
  });
});

/**
 * @desc    Get fee details
 * @route   GET /api/student/fees/:id
 * @access  Private (Student)
 */
const getFeeDetails = asyncHandler(async (req, res, next) => {
  const fee = await Fee.findOne({
    _id: req.params.id,
    student: req.user._id,
  });

  if (!fee) {
    return next(new AppError('Fee record not found', 404));
  }

  res.status(200).json({
    success: true,
    data: fee,
  });
});

/**
 * @desc    Get course schedule
 * @route   GET /api/student/schedule
 * @access  Private (Student)
 */
const getSchedule = asyncHandler(async (req, res, next) => {
  const studentId = req.user._id;

  // Get active enrollments with course details
  const enrollments = await Enrollment.find({
    student: studentId,
    status: 'enrolled',
  }).populate('course');

  // Extract and organize schedule
  const schedule = {};

  enrollments.forEach((enrollment) => {
    const course = enrollment.course;

    course.schedule.forEach((session) => {
      if (!schedule[session.day]) {
        schedule[session.day] = [];
      }

      schedule[session.day].push({
        courseCode: course.courseCode,
        courseName: course.courseName,
        startTime: session.startTime,
        endTime: session.endTime,
        location: session.location,
        instructor: course.instructor.name,
      });
    });
  });

  // Sort each day's schedule by start time
  Object.keys(schedule).forEach((day) => {
    schedule[day].sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });
  });

  res.status(200).json({
    success: true,
    data: schedule,
  });
});

module.exports = {
  getDashboard,
  getEnrollments,
  getEnrollmentDetails,
  enrollInCourse,
  getFees,
  getFeeDetails,
  getSchedule,
};
