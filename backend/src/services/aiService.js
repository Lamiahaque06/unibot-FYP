/**
 * AI Service Client
 * Communicates with the Python FastAPI RAG service.
 * Falls back gracefully to rule-based responses if the AI service is unavailable.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Check if the AI service is healthy and RAG is enabled.
 * @returns {Promise<{available: boolean, ragEnabled: boolean}>}
 */
async function checkHealth() {
  try {
    const { data } = await aiClient.get('/health', { timeout: 3000 });
    return {
      available: data.status === 'healthy',
      ragEnabled: data.rag_enabled || false,
      vectorCount: data.vector_count || 0,
    };
  } catch {
    return { available: false, ragEnabled: false, vectorCount: 0 };
  }
}

/**
 * Query the AI service for a RAG-powered response.
 *
 * @param {Object} params
 * @param {string} params.query - User's message
 * @param {Array}  params.conversationHistory - Recent messages [{role, content}]
 * @param {Object|null} params.userContext - Student personalisation data
 * @param {boolean} params.useRag - Whether to enable vector retrieval
 * @returns {Promise<Object>} AI service response
 */
async function queryAI({ query, conversationHistory = [], userContext = null, useRag = true }) {
  const payload = {
    query,
    conversation_history: conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    user_context: userContext,
    use_rag: useRag,
  };

  const { data } = await aiClient.post('/chat/query', payload);
  return data;
}

/**
 * Trigger document processing in the AI service.
 *
 * @param {Object} params
 * @param {string} params.documentId - MongoDB document ID
 * @param {string} params.documentName - File display name
 * @param {string} params.filePath - Absolute path to the uploaded file
 * @param {string} params.category - Document category
 * @param {string[]} params.tags - Optional tags
 * @returns {Promise<Object>} Processing result
 */
async function processDocument({ documentId, documentName, filePath, category = 'general', tags = [] }) {
  const payload = {
    document_id: documentId,
    document_name: documentName,
    file_path: filePath,
    category,
    tags,
  };

  const { data } = await aiClient.post('/documents/process', payload, {
    timeout: 120000, // 2 minutes for large documents
  });
  return data;
}

/**
 * Delete a document's vectors from Pinecone.
 * @param {string} documentId
 */
async function deleteDocumentVectors(documentId) {
  try {
    const { data } = await aiClient.delete(`/documents/${documentId}`);
    return data;
  } catch (err) {
    logger.warn(`Could not delete vectors for document ${documentId}: ${err.message}`);
    return { vectors_deleted: 0 };
  }
}

/**
 * Ingest FAQ entries from MongoDB into Pinecone.
 * @param {Array} faqs - Array of FAQ objects from MongoDB
 */
async function ingestFAQs(faqs) {
  const payload = {
    faqs: faqs.map((f) => ({
      faq_id: f._id.toString(),
      question: f.question,
      answer: f.answer,
      category: f.category,
      keywords: f.keywords || [],
    })),
  };

  const { data } = await aiClient.post('/documents/ingest-faqs', payload, {
    timeout: 120000,
  });
  return data;
}

/**
 * Run RAGAS-inspired evaluation on QA samples.
 * @param {Array} samples - [{query, answer, contexts, ground_truth}]
 */
async function runEvaluation(samples) {
  const { data } = await aiClient.post('/evaluation/run', { samples });
  return data;
}

/**
 * Run the built-in demo evaluation.
 */
async function runDemoEvaluation() {
  const { data } = await aiClient.get('/evaluation/demo');
  return data;
}

module.exports = {
  checkHealth,
  queryAI,
  processDocument,
  deleteDocumentVectors,
  ingestFAQs,
  runEvaluation,
  runDemoEvaluation,
};
