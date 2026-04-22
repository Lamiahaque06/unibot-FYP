const mongoose = require('mongoose');

/**
 * Document Schema
 * Stores uploaded documents for the knowledge base
 * Will be used for RAG implementation with embeddings
 */

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // File information
    fileName: {
      type: String,
      required: [true, 'File name is required'],
    },
    filePath: {
      type: String,
      required: [true, 'File path is required'],
    },
    fileType: {
      type: String,
      enum: ['pdf', 'doc', 'docx', 'txt', 'html', 'json'],
      required: [true, 'File type is required'],
    },
    fileSize: {
      type: Number, // in bytes
      required: [true, 'File size is required'],
    },
    // Content
    extractedText: {
      type: String, // Extracted text content from document
    },
    // Categorization
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
        'general',
        'other',
      ],
      default: 'general',
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    // For future RAG implementation
    embedding: {
      // Vector embeddings will be stored in Pinecone
      // This field tracks if embedding has been generated
      isProcessed: {
        type: Boolean,
        default: false,
      },
      processedAt: {
        type: Date,
      },
      // Reference to Pinecone vector ID
      vectorId: {
        type: String,
      },
      // Chunking information
      chunks: {
        type: Number,
        default: 0,
      },
    },
    // Upload information
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Status
    status: {
      type: String,
      enum: ['pending', 'processing', 'active', 'inactive', 'error'],
      default: 'pending',
    },
    // Error tracking
    processingError: {
      type: String,
    },
    // Version control
    version: {
      type: Number,
      default: 1,
    },
    // Access control
    isPublic: {
      type: Boolean,
      default: true,
    },
    // Usage statistics
    stats: {
      views: {
        type: Number,
        default: 0,
      },
      references: {
        type: Number,
        default: 0, // How many times cited in chatbot responses
      },
      lastAccessed: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
documentSchema.index({ category: 1, status: 1 });
documentSchema.index({ uploadedBy: 1 });
documentSchema.index({ 'embedding.isProcessed': 1 });
documentSchema.index({ tags: 1 });

/**
 * Increment view count
 */
documentSchema.methods.incrementViews = async function () {
  this.stats.views += 1;
  this.stats.lastAccessed = new Date();
  await this.save();
};

/**
 * Increment reference count
 */
documentSchema.methods.incrementReferences = async function () {
  this.stats.references += 1;
  await this.save();
};

/**
 * Mark as processed with embedding info
 * @param {Object} embeddingInfo - Embedding information
 */
documentSchema.methods.markAsProcessed = async function (embeddingInfo = {}) {
  this.embedding.isProcessed = true;
  this.embedding.processedAt = new Date();
  this.embedding.vectorId = embeddingInfo.vectorId || '';
  this.embedding.chunks = embeddingInfo.chunks || 0;
  this.status = 'active';
  await this.save();
};

/**
 * Mark as processing error
 * @param {string} error - Error message
 */
documentSchema.methods.markAsError = async function (error) {
  this.status = 'error';
  this.processingError = error;
  await this.save();
};

/**
 * Get file size in readable format
 * @returns {string} - Formatted file size
 */
documentSchema.methods.getFormattedFileSize = function () {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
