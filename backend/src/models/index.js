/**
 * Models Index
 * Central export point for all MongoDB models
 */

const User = require('./User');
const Course = require('./Course');
const Enrollment = require('./Enrollment');
const Fee = require('./Fee');
const Conversation = require('./Conversation');
const Document = require('./Document');
const FAQ = require('./FAQ');

module.exports = {
  User,
  Course,
  Enrollment,
  Fee,
  Conversation,
  Document,
  FAQ,
};
