const mongoose = require('mongoose');

/**
 * FAQ Schema
 * Stores frequently asked questions and answers
 * Used for rule-based chatbot responses in interim version
 */

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, 'Question is required'],
      trim: true,
    },
    answer: {
      type: String,
      required: [true, 'Answer is required'],
    },
    // Category for organization
    category: {
      type: String,
      enum: [
        'admissions',
        'courses',
        'fees',
        'hostel',
        'examinations',
        'academic_policies',
        'campus_life',
        'technical_support',
        'general',
      ],
      required: [true, 'Category is required'],
    },
    // Keywords for matching
    keywords: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    // Alternative questions (variations)
    variations: [
      {
        type: String,
        trim: true,
      },
    ],
    // Priority for ranking
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    // Status
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'active',
    },
    // Usage statistics
    stats: {
      views: {
        type: Number,
        default: 0,
      },
      helpful: {
        type: Number,
        default: 0,
      },
      notHelpful: {
        type: Number,
        default: 0,
      },
      lastAccessed: {
        type: Date,
      },
    },
    // Related FAQs
    relatedFAQs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FAQ',
      },
    ],
    // Admin information
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient searching
faqSchema.index({ category: 1, status: 1 });
faqSchema.index({ keywords: 1 });
faqSchema.index({ priority: -1 });
faqSchema.index({ 'stats.views': -1 });

/**
 * Increment view count
 */
faqSchema.methods.incrementViews = async function () {
  this.stats.views += 1;
  this.stats.lastAccessed = new Date();
  await this.save();
};

/**
 * Mark as helpful
 */
faqSchema.methods.markAsHelpful = async function () {
  this.stats.helpful += 1;
  await this.save();
};

/**
 * Mark as not helpful
 */
faqSchema.methods.markAsNotHelpful = async function () {
  this.stats.notHelpful += 1;
  await this.save();
};

/**
 * Calculate helpfulness score
 * @returns {number} - Helpfulness ratio
 */
faqSchema.methods.getHelpfulnessScore = function () {
  const total = this.stats.helpful + this.stats.notHelpful;
  if (total === 0) return 0;
  return (this.stats.helpful / total) * 100;
};

/**
 * Check if question matches this FAQ
 * @param {string} query - User query
 * @returns {number} - Match score (0-1)
 */
faqSchema.methods.getMatchScore = function (query) {
  const queryLower = query.toLowerCase();
  let score = 0;

  // Check exact question match
  if (this.question.toLowerCase() === queryLower) {
    return 1;
  }

  // Check variations
  for (const variation of this.variations) {
    if (variation.toLowerCase() === queryLower) {
      return 0.95;
    }
  }

  // Check if question words are in query (more lenient)
  const questionWords = this.question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const queryWords = queryLower.split(/\s+/);
  const commonWords = questionWords.filter(w => queryWords.includes(w));
  if (commonWords.length > 2) {
    score = Math.max(score, 0.7);
  }

  // Check keyword matches (more lenient - 0.5 per keyword)
  const matchedKeywords = this.keywords.filter((keyword) =>
    queryLower.includes(keyword.toLowerCase())
  );

  if (matchedKeywords.length > 0) {
    score = Math.max(score, Math.min(0.9, matchedKeywords.length * 0.5));
  }

  return score;
};

/**
 * Static method to find matching FAQs
 * @param {string} query - User query
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Matching FAQs sorted by relevance
 */
faqSchema.statics.findMatching = async function (query, limit = 5) {
  const faqs = await this.find({ status: 'active' });

  // Calculate match scores
  const scored = faqs.map((faq) => ({
    faq,
    score: faq.getMatchScore(query),
  }));

  // Filter and sort by score (lowered threshold to 0.2)
  return scored
    .filter((item) => item.score > 0.2)
    .sort((a, b) => {
      // First sort by score
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Then by priority
      return b.faq.priority - a.faq.priority;
    })
    .slice(0, limit)
    .map((item) => item.faq);
};

const FAQ = mongoose.model('FAQ', faqSchema);

module.exports = FAQ;
