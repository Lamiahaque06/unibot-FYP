const mongoose = require('mongoose');

/**
 * Enrollment Schema
 * Manages student enrollments in courses
 * Tracks enrollment status, grades, and attendance
 */

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required'],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
    },
    semester: {
      type: String,
      enum: ['Fall', 'Spring', 'Summer'],
      required: [true, 'Semester is required'],
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['enrolled', 'dropped', 'completed', 'withdrawn'],
      default: 'enrolled',
    },
    // Academic performance
    grade: {
      letter: {
        type: String,
        enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'W', 'I', 'P', ''],
        default: '',
      },
      percentage: {
        type: Number,
        min: 0,
        max: 100,
      },
      gpa: {
        type: Number,
        min: 0,
        max: 4.0,
      },
    },
    // Attendance tracking
    attendance: {
      totalClasses: {
        type: Number,
        default: 0,
      },
      attendedClasses: {
        type: Number,
        default: 0,
      },
    },
    // Assignment and exam tracking
    assignments: [
      {
        title: String,
        dueDate: Date,
        submitted: {
          type: Boolean,
          default: false,
        },
        score: Number,
        maxScore: Number,
      },
    ],
    exams: [
      {
        title: String,
        date: Date,
        score: Number,
        maxScore: Number,
        type: {
          type: String,
          enum: ['midterm', 'final', 'quiz', 'other'],
        },
      },
    ],
    // Withdrawal information (if applicable)
    withdrawalDate: {
      type: Date,
    },
    withdrawalReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure a student can't enroll in the same course twice in the same semester
enrollmentSchema.index({ student: 1, course: 1, semester: 1, year: 1 }, { unique: true });

// Index for common queries
enrollmentSchema.index({ student: 1, status: 1 });
enrollmentSchema.index({ course: 1, status: 1 });

/**
 * Calculate attendance percentage
 * @returns {number} - Attendance percentage
 */
enrollmentSchema.methods.getAttendancePercentage = function () {
  if (this.attendance.totalClasses === 0) return 0;
  return (this.attendance.attendedClasses / this.attendance.totalClasses) * 100;
};

/**
 * Get upcoming assignments
 * @returns {Array} - Array of upcoming assignments
 */
enrollmentSchema.methods.getUpcomingAssignments = function () {
  const now = new Date();
  return this.assignments.filter(
    (assignment) => new Date(assignment.dueDate) > now && !assignment.submitted
  );
};

/**
 * Get upcoming exams
 * @returns {Array} - Array of upcoming exams
 */
enrollmentSchema.methods.getUpcomingExams = function () {
  const now = new Date();
  return this.exams.filter((exam) => new Date(exam.date) > now);
};

/**
 * Calculate overall course progress
 * @returns {Object} - Progress statistics
 */
enrollmentSchema.methods.getCourseProgress = function () {
  const totalAssignments = this.assignments.length;
  const submittedAssignments = this.assignments.filter((a) => a.submitted).length;
  const assignmentProgress = totalAssignments > 0 ? (submittedAssignments / totalAssignments) * 100 : 0;

  return {
    assignmentProgress,
    attendancePercentage: this.getAttendancePercentage(),
    currentGrade: this.grade.percentage || 0,
  };
};

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

module.exports = Enrollment;
