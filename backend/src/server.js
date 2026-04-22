require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const routes = require('./routes');
const { errorHandler, notFound, apiLimiter } = require('./middleware');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * Initialize Express App
 */
const app = express();

/**
 * Connect to Database
 */
connectDB();

/**
 * Create required directories
 */
const createDirectories = () => {
  const directories = ['uploads', 'logs'];

  directories.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

createDirectories();

/**
 * Security Middleware
 */
app.use(helmet()); // Security headers

/**
 * CORS Configuration
 */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

/**
 * Body Parser Middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Static Files
 */
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

/**
 * Request Logging Middleware (Development)
 */
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.http(`${req.method} ${req.originalUrl}`);
    next();
  });
}

/**
 * Apply Rate Limiting
 */
app.use('/api', apiLimiter);

/**
 * API Routes
 */
app.use('/api', routes);

/**
 * Root Route
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to College Support Chatbot API',
    version: '1.0.0 (Interim)',
    documentation: '/api/health',
    endpoints: {
      auth: '/api/auth',
      student: '/api/student',
      chat: '/api/chat',
      admin: '/api/admin',
    },
  });
});

/**
 * Error Handling
 */
app.use(notFound); // 404 handler
app.use(errorHandler); // Global error handler

/**
 * Start Server
 */
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info('='.repeat(50));
  logger.info(`College Support Chatbot Backend (Interim Version)`);
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  logger.info('='.repeat(50));
});

/**
 * Handle Unhandled Promise Rejections
 */
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  logger.error(err.stack);

  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

/**
 * Handle SIGTERM
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

module.exports = app;
