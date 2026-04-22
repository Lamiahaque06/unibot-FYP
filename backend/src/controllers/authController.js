const { User } = require('../models');
const { generateUserToken } = require('../utils/jwt');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles user registration, login, and profile management
 */

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName, role, studentId, major, enrollmentYear, semester } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('User with this email already exists', 400));
  }

  // Check if studentId already exists (for students)
  if (studentId) {
    const existingStudent = await User.findOne({ 'profile.studentId': studentId });
    if (existingStudent) {
      return next(new AppError('Student ID already registered', 400));
    }
  }

  // Create user
  const user = await User.create({
    email,
    password,
    role: role || 'student',
    profile: {
      firstName,
      lastName,
      studentId,
      major,
      enrollmentYear,
      semester,
    },
  });

  // Generate token
  const token = generateUserToken(user);

  logger.info(`New user registered: ${email} (${user.role})`);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: user.getPublicProfile(),
      token,
    },
  });
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Find user and include password field
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new AppError('Invalid email or password', 401));
  }

  // Check if account is active
  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 401));
  }

  // Verify password
  const isPasswordMatch = await user.matchPassword(password);

  if (!isPasswordMatch) {
    return next(new AppError('Invalid email or password', 401));
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token
  const token = generateUserToken(user);

  logger.info(`User logged in: ${email}`);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: user.getPublicProfile(),
      token,
    },
  });
});

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res, next) => {
  // User is already attached to req by protect middleware
  const user = await User.findById(req.user._id);

  res.status(200).json({
    success: true,
    data: {
      user: user.getPublicProfile(),
    },
  });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, phoneNumber, address } = req.body;

  const user = await User.findById(req.user._id);

  // Update profile fields
  if (firstName) user.profile.firstName = firstName;
  if (lastName) user.profile.lastName = lastName;
  if (phoneNumber) user.profile.phoneNumber = phoneNumber;
  if (address) user.profile.address = address;

  await user.save();

  logger.info(`User profile updated: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: user.getPublicProfile(),
    },
  });
});

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current and new password', 400));
  }

  if (newPassword.length < 6) {
    return next(new AppError('New password must be at least 6 characters long', 400));
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return next(new AppError('Current password is incorrect', 401));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  logger.info(`Password changed for user: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

/**
 * @desc    Logout user (client-side token removal)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res, next) => {
  logger.info(`User logged out: ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
};
