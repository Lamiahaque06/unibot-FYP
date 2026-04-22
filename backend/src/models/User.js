const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema
 * Handles both students and administrators
 * Includes authentication and profile information
 */

const userSchema = new mongoose.Schema(
  {
    // Authentication fields
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },

    // Role-based access control
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },

    // Profile information
    profile: {
      firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
      },
      lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
      },
      studentId: {
        type: String,
        unique: true,
        sparse: true, // Allow null for admin users
        trim: true,
      },
      phoneNumber: {
        type: String,
        trim: true,
      },
      dateOfBirth: {
        type: Date,
      },
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
      },
      // For students
      enrollmentYear: {
        type: Number,
      },
      major: {
        type: String,
      },
      semester: {
        type: Number,
      },
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Last login tracking
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ 'profile.studentId': 1 });

/**
 * Pre-save middleware to hash password before saving
 */
userSchema.pre('save', async function (next) {
  // Only hash password if it's modified or new
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Method to compare entered password with hashed password
 * @param {string} enteredPassword - Password entered by user
 * @returns {Promise<boolean>} - True if passwords match
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Method to get user's full name
 * @returns {string} - Full name of user
 */
userSchema.methods.getFullName = function () {
  return `${this.profile.firstName} ${this.profile.lastName}`;
};

/**
 * Method to get public profile (without sensitive data)
 * @returns {Object} - Public profile data
 */
userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    email: this.email,
    role: this.role,
    profile: this.profile,
    isActive: this.isActive,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
