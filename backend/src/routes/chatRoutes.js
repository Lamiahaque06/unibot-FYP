const express = require('express');
const { chatController } = require('../controllers');
const { optionalAuth, protect, validator, chatLimiter } = require('../middleware');

const router = express.Router();

/**
 * Chat Routes
 */

// @route   POST /api/chat/message
// @desc    Send message to chatbot
// @access  Public (optionally authenticated for personalized responses)
router.post('/message', optionalAuth, chatLimiter, validator.validateMessage, chatController.sendMessage);

// @route   POST /api/chat/conversations
// @desc    Create new conversation
// @access  Private
router.post('/conversations', protect, chatController.createConversation);

// @route   GET /api/chat/conversations
// @desc    Get all conversations for user
// @access  Private
router.get('/conversations', protect, validator.validatePagination, chatController.getConversations);

// @route   GET /api/chat/conversations/:id
// @desc    Get specific conversation
// @access  Private
router.get('/conversations/:id', protect, validator.validateObjectId, chatController.getConversation);

// @route   PUT /api/chat/conversations/:id/archive
// @desc    Archive conversation
// @access  Private
router.put('/conversations/:id/archive', protect, validator.validateObjectId, chatController.archiveConversation);

// @route   DELETE /api/chat/conversations/:id
// @desc    Delete conversation
// @access  Private
router.delete('/conversations/:id', protect, validator.validateObjectId, chatController.deleteConversation);

// @route   POST /api/chat/conversations/:id/feedback
// @desc    Add feedback to conversation
// @access  Private
router.post('/conversations/:id/feedback', protect, validator.validateObjectId, chatController.addFeedback);

// @route   GET /api/chat/ai-status
// @desc    Check AI service health (admin only)
// @access  Private
router.get('/ai-status', protect, chatController.getAIStatus);

module.exports = router;
