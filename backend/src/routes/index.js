/**
 * Routes Index
 * Central export and mounting point for all routes
 */

const express = require('express');
const authRoutes = require('./authRoutes');
const studentRoutes = require('./studentRoutes');
const chatRoutes = require('./chatRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

/**
 * Mount all routes
 */
router.use('/auth', authRoutes);
router.use('/student', studentRoutes);
router.use('/chat', chatRoutes);
router.use('/admin', adminRoutes);

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
