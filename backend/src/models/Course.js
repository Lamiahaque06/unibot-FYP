const mongoose = require('mongoose');

/**
 * Course Schema
 * Stores course information including schedules, instructors, and prerequisites
 */

const courseSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: [true, 'Course code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    courseName: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Course description is required'],
    },
    credits: {
      type: Number,
      required: [true, 'Credits are required'],
      min: [1, 'Credits must be at least 1'],
      max: [6, 'Credits cannot exceed 6'],
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    level: {
      type: String,
      enum: ['undergraduate', 'graduate'],
      default: 'undergraduate',
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
    // Instructor information
    instructor: {
      name: {
        type: String,
        required: [true, 'Instructor name is required'],
      },
      email: {
        type: String,
        match: [
          /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
          'Please provide a valid email',
        ],
      },
      officeHours: {
        type: String,
      },
      officeLocation: {
        type: String,
      },
    },
    // Schedule information
    schedule: [
      {
        day: {
          type: String,
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          required: true,
        },
        startTime: {
          type: String,
          required: true,
        },
        endTime: {
          type: String,
          required: true,
        },
        location: {
          type: String,
          required: true,
        },
      },
    ],
    // Prerequisites
    prerequisites: [
      {
        type: String, // Course codes
      },
    ],
    // Maximum enrollment capacity
    maxEnrollment: {
      type: Number,
      default: 30,
    },
    // Current enrollment count
    currentEnrollment: {
      type: Number,
      default: 0,
    },
    // Course status
    status: {
      type: String,
      enum: ['active', 'inactive', 'full'],
      default: 'active',
    },
    // Syllabus and resources
    syllabus: {
      type: String, // URL or file path
    },
    resources: [
      {
        title: String,
        url: String,
        type: {
          type: String,
          enum: ['document', 'video', 'link', 'other'],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
courseSchema.index({ courseCode: 1 });
courseSchema.index({ department: 1, semester: 1, year: 1 });
courseSchema.index({ status: 1 });

/**
 * Method to check if course is full
 * @returns {boolean} - True if course is at capacity
 */
courseSchema.methods.isFull = function () {
  return this.currentEnrollment >= this.maxEnrollment;
};

/**
 * Method to get available seats
 * @returns {number} - Number of available seats
 */
courseSchema.methods.getAvailableSeats = function () {
  return Math.max(0, this.maxEnrollment - this.currentEnrollment);
};

/**
 * Update course status based on enrollment
 */
courseSchema.methods.updateStatus = async function () {
  if (this.currentEnrollment >= this.maxEnrollment) {
    this.status = 'full';
  } else if (this.status === 'full' && this.currentEnrollment < this.maxEnrollment) {
    this.status = 'active';
  }
  await this.save();
};

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
