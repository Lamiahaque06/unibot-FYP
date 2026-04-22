/**
 * Controllers Index
 * Central export point for all controllers
 */

const authController = require('./authController');
const studentController = require('./studentController');
const chatController = require('./chatController');
const adminController = require('./adminController');

module.exports = {
  authController,
  studentController,
  chatController,
  adminController,
};
