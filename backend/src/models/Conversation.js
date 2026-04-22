const mongoose = require('mongoose');

/**
 * Conversation Schema
 * Stores chat history with context for multi-turn conversations
 * Enables personalized responses based on conversation history
 */

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    // Conversation metadata
    title: {
      type: String,
      default: 'New Conversation',
    },
    // Message history
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'assistant', 'system'],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        // Metadata for tracking
        metadata: {
          // RAG source documents used to generate this response
          sources: [
            {
              document_id: String,
              document_name: String,
              chunk_text: String,
              relevance_score: Number,
              page_number: Number,
              category: String,
            },
          ],
          // Confidence score (future implementation)
          confidence: {
            type: Number,
            min: 0,
            max: 1,
          },
          // Intent classification (future implementation)
          intent: {
            type: String,
          },
          // Response time in milliseconds
          responseTime: {
            type: Number,
          },
        },
      },
    ],
    // Conversation status
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
    },
    // Tags for categorization
    tags: [
      {
        type: String,
      },
    ],
    // Feedback
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: {
        type: String,
      },
      feedbackDate: {
        type: Date,
      },
    },
    // Last activity tracking
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
conversationSchema.index({ user: 1, status: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ createdAt: -1 });

/**
 * Get conversation summary
 * @returns {Object} - Conversation summary
 */
conversationSchema.methods.getSummary = function () {
  return {
    _id: this._id,
    title: this.title,
    messageCount: this.messages.length,
    lastMessage: this.messages[this.messages.length - 1]?.content.substring(0, 100) || '',
    lastMessageAt: this.lastMessageAt,
    status: this.status,
  };
};

/**
 * Add a message to the conversation
 * @param {Object} messageData - Message data
 */
conversationSchema.methods.addMessage = async function (messageData) {
  // Validate message data before adding
  if (!messageData.content || typeof messageData.content !== 'string') {
    throw new Error('Message content is required and must be a string');
  }

  if (!messageData.role || !['user', 'assistant', 'system'].includes(messageData.role)) {
    throw new Error('Message role is required and must be user, assistant, or system');
  }

  this.messages.push(messageData);
  this.lastMessageAt = new Date();

  // Auto-generate title from first user message if still default
  if (this.title === 'New Conversation' && messageData.role === 'user' && this.messages.length <= 2) {
    this.title = messageData.content.substring(0, 50) + (messageData.content.length > 50 ? '...' : '');
  }

  try {
    await this.save();
  } catch (error) {
    // If save fails, remove the message we just added to keep the document clean
    this.messages.pop();
    throw error;
  }
};

/**
 * Get recent messages for context
 * @param {number} limit - Number of recent messages to retrieve
 * @returns {Array} - Recent messages
 */
conversationSchema.methods.getRecentMessages = function (limit = 10) {
  return this.messages.slice(-limit);
};

/**
 * Get conversation context (for RAG implementation)
 * @returns {string} - Formatted context string
 */
conversationSchema.methods.getContext = function () {
  const recentMessages = this.getRecentMessages(5);
  return recentMessages
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');
};

/**
 * Archive conversation
 */
conversationSchema.methods.archive = async function () {
  this.status = 'archived';
  await this.save();
};

/**
 * Delete conversation (soft delete)
 */
conversationSchema.methods.softDelete = async function () {
  this.status = 'deleted';
  await this.save();
};

/**
 * Add feedback to conversation
 * @param {Object} feedbackData - Feedback data
 */
conversationSchema.methods.addFeedback = async function (feedbackData) {
  this.feedback = {
    ...feedbackData,
    feedbackDate: new Date(),
  };
  await this.save();
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
