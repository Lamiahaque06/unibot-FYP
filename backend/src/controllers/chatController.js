/**
 * Chat Controller
 * Handles all conversational interactions.
 *
 * Flow:
 *   1. Validate & load/create Conversation document
 *   2. Build student context (enrollments, fees) for authenticated users
 *   3. Call Python AI service (RAG + Gemini) — falls back to rule-based on failure
 *   4. Persist messages and return response to frontend
 */

const { Conversation, Enrollment, Fee, Course } = require('../models');
const chatbotService = require('../services/chatbotService');
const aiService = require('../services/aiService');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a UserContext payload for the AI service using live MongoDB data.
 */
async function buildUserContext(user) {
  if (!user) return null;

  try {
    // Enrolled courses
    const enrollments = await Enrollment.find({
      student: user._id,
      status: 'enrolled',
    })
      .populate('course')
      .limit(10)
      .lean();

    const enrolledCourses = enrollments.map((e) => ({
      courseCode: e.course?.courseCode || '',
      courseName: e.course?.courseName || '',
      credits: e.course?.credits || 0,
      instructor: e.course?.instructor || {},
      schedule: e.course?.schedule || {},
      semester: e.course?.semester || '',
    }));

    // Pending fees
    const fees = await Fee.find({
      student: user._id,
      status: { $in: ['pending', 'overdue', 'partial'] },
    })
      .sort({ dueDate: 1 })
      .limit(10)
      .lean();

    const pendingFees = fees.map((f) => ({
      description: f.description,
      amount: f.getRemainingBalance ? f.getRemainingBalance() : f.amount,
      dueDate: f.dueDate ? f.dueDate.toLocaleDateString('en-GB') : 'N/A',
      status: f.status,
    }));

    // Upcoming deadlines (from assignments in enrollments)
    const upcomingDeadlines = [];
    for (const enrollment of enrollments) {
      const assignments = enrollment.assignments || [];
      for (const assignment of assignments) {
        if (assignment.dueDate && new Date(assignment.dueDate) > new Date()) {
          upcomingDeadlines.push({
            title: `${enrollment.course?.courseCode}: ${assignment.title}`,
            date: new Date(assignment.dueDate).toLocaleDateString('en-GB'),
          });
        }
      }
    }
    upcomingDeadlines.sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      user_id: user._id.toString(),
      name: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
      student_id: user.profile?.studentId || null,
      enrolled_courses: enrolledCourses,
      pending_fees: pendingFees,
      upcoming_deadlines: upcomingDeadlines.slice(0, 5),
    };
  } catch (err) {
    logger.error(`buildUserContext error: ${err.message}`);
    return null;
  }
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc    Send message to chatbot
 * @route   POST /api/chat/message
 * @access  Public (enhanced when authenticated)
 */
const sendMessage = asyncHandler(async (req, res, next) => {
  const { message, conversationId } = req.body;
  const user = req.user || null;

  if (!message || message.trim().length === 0) {
    return next(new AppError('Message cannot be empty', 400));
  }

  // ── Load or create conversation ──────────────────────────────────────────
  let conversation;

  if (conversationId) {
    conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return next(new AppError('Conversation not found', 404));
    }
    if (user && conversation.user && conversation.user.toString() !== user._id.toString()) {
      return next(new AppError('Unauthorized access to conversation', 403));
    }
  }

  if (!conversation) {
    conversation = await Conversation.create({
      user: user ? user._id : null,
      title: message.substring(0, 50),
      messages: [],
    });
  }

  // ── Save user message ─────────────────────────────────────────────────────
  await conversation.addMessage({ role: 'user', content: message });

  // ── Fetch recent history for multi-turn context (FR5) ─────────────────────
  const history = conversation.getRecentMessages(10);

  // ── Try AI service first; fall back to rule-based ─────────────────────────
  let botResponse;
  let aiUsed = false;

  try {
    const userContext = await buildUserContext(user);
    const aiResult = await aiService.queryAI({
      query: message,
      conversationHistory: history,
      userContext,
      useRag: true,
    });

    botResponse = {
      content: aiResult.answer,
      metadata: {
        intent: aiResult.intent || 'general',
        sources: aiResult.sources || [],
        confidence: aiResult.confidence || 0.8,
        responseTime: aiResult.response_time_ms || 0,
        ragUsed: aiResult.rag_used || false,
        modelUsed: aiResult.model_used || 'gemini',
      },
    };
    aiUsed = true;
  } catch (aiError) {
    logger.warn(`AI service unavailable (${aiError.message}), falling back to rule-based`);
    try {
      botResponse = await chatbotService.processMessage(message, user, history);
      botResponse.metadata = botResponse.metadata || {};
      botResponse.metadata.ragUsed = false;
      botResponse.metadata.modelUsed = 'rule_based_fallback';
    } catch (fallbackError) {
      logger.error(`Rule-based fallback also failed: ${fallbackError.message}`);
      botResponse = {
        content:
          "I'm sorry, I'm having trouble processing your request right now. Please try again shortly.",
        metadata: {
          intent: 'error',
          sources: [],
          confidence: 0,
          responseTime: 0,
          ragUsed: false,
          modelUsed: 'error',
        },
      };
    }
  }

  // ── Save bot response ─────────────────────────────────────────────────────
  await conversation.addMessage({
    role: 'assistant',
    content: botResponse.content,
    metadata: botResponse.metadata,
  });

  logger.info(
    `Chat response — intent=${botResponse.metadata?.intent}, ` +
    `ai=${aiUsed}, rag=${botResponse.metadata?.ragUsed}, ` +
    `time=${botResponse.metadata?.responseTime}ms`
  );

  res.status(200).json({
    success: true,
    data: {
      conversationId: conversation._id,
      message: {
        role: 'assistant',
        content: botResponse.content,
        metadata: botResponse.metadata,
      },
    },
  });
});

/**
 * @desc    Get all conversations for user
 * @route   GET /api/chat/conversations
 * @access  Private
 */
const getConversations = asyncHandler(async (req, res, next) => {
  const { status = 'active', page = 1, limit = 20 } = req.query;

  const query = { user: req.user._id, status };
  const conversations = await Conversation.find(query)
    .sort({ lastMessageAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const count = await Conversation.countDocuments(query);
  const summaries = conversations.map((conv) => conv.getSummary());

  res.status(200).json({
    success: true,
    data: summaries,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  });
});

/**
 * @desc    Get single conversation
 * @route   GET /api/chat/conversations/:id
 * @access  Private
 */
const getConversation = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!conversation) {
    return next(new AppError('Conversation not found', 404));
  }

  res.status(200).json({ success: true, data: conversation });
});

/**
 * @desc    Create new conversation
 * @route   POST /api/chat/conversations
 * @access  Private
 */
const createConversation = asyncHandler(async (req, res, next) => {
  const { title } = req.body;
  const conversation = await Conversation.create({
    user: req.user._id,
    title: title || 'New Conversation',
  });
  res.status(201).json({ success: true, message: 'Conversation created', data: conversation });
});

/**
 * @desc    Archive conversation
 * @route   PUT /api/chat/conversations/:id/archive
 * @access  Private
 */
const archiveConversation = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!conversation) return next(new AppError('Conversation not found', 404));
  await conversation.archive();
  res.status(200).json({ success: true, message: 'Conversation archived' });
});

/**
 * @desc    Delete conversation
 * @route   DELETE /api/chat/conversations/:id
 * @access  Private
 */
const deleteConversation = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!conversation) return next(new AppError('Conversation not found', 404));
  await conversation.softDelete();
  res.status(200).json({ success: true, message: 'Conversation deleted' });
});

/**
 * @desc    Add feedback
 * @route   POST /api/chat/conversations/:id/feedback
 * @access  Private
 */
const addFeedback = asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return next(new AppError('Rating must be between 1 and 5', 400));
  }
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!conversation) return next(new AppError('Conversation not found', 404));
  await conversation.addFeedback({ rating, comment });
  logger.info(`Feedback ${rating}/5 for conversation ${conversation._id}`);
  res.status(200).json({ success: true, message: 'Thank you for your feedback!' });
});

/**
 * @desc    Get AI service status
 * @route   GET /api/chat/ai-status
 * @access  Private (Admin)
 */
const getAIStatus = asyncHandler(async (req, res, next) => {
  const health = await aiService.checkHealth();
  res.status(200).json({ success: true, data: health });
});

module.exports = {
  sendMessage,
  getConversation,
  getConversations,
  createConversation,
  archiveConversation,
  deleteConversation,
  addFeedback,
  getAIStatus,
};
