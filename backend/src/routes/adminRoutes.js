const express = require('express');
const { adminController } = require('../controllers');
const { protect, authorize, validator } = require('../middleware');
const upload = require('../middleware/upload');

const router = express.Router();

/**
 * Admin Routes
 * All routes are protected and require admin role
 */

// Apply authentication and authorization middleware to all routes
router.use(protect);
router.use(authorize('admin'));

// Dashboard
// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', adminController.getDashboard);

// User Management
// @route   GET /api/admin/users
// @desc    Get all users with filtering
// @access  Private (Admin)
router.get('/users', validator.validatePagination, adminController.getUsers);

// Course Management
// @route   GET /api/admin/courses
// @desc    Get all courses
// @access  Private (Admin)
router.get('/courses', validator.validatePagination, adminController.getCourses);

// @route   POST /api/admin/courses
// @desc    Create new course
// @access  Private (Admin)
router.post('/courses', validator.validateCourse, adminController.createCourse);

// @route   PUT /api/admin/courses/:id
// @desc    Update course
// @access  Private (Admin)
router.put('/courses/:id', validator.validateObjectId, adminController.updateCourse);

// @route   DELETE /api/admin/courses/:id
// @desc    Delete course
// @access  Private (Admin)
router.delete('/courses/:id', validator.validateObjectId, adminController.deleteCourse);

// Document Management
// @route   GET /api/admin/documents
// @desc    Get all documents
// @access  Private (Admin)
router.get('/documents', validator.validatePagination, adminController.getDocuments);

// @route   POST /api/admin/documents
// @desc    Upload document
// @access  Private (Admin)
router.post(
	'/documents',
	upload.fields([
		{ name: 'file', maxCount: 1 },
		{ name: 'document', maxCount: 1 },
	]),
	(req, res, next) => {
		// Normalize accepted upload fields so controller can keep using req.file
		if (!req.file && req.files) {
			req.file = (req.files.file && req.files.file[0]) || (req.files.document && req.files.document[0]);
		}
		next();
	},
	adminController.uploadDocument
);

// @route   DELETE /api/admin/documents/:id
// @desc    Delete document
// @access  Private (Admin)
router.delete('/documents/:id', validator.validateObjectId, adminController.deleteDocument);

// FAQ Management
// @route   GET /api/admin/faqs
// @desc    Get all FAQs
// @access  Private (Admin)
router.get('/faqs', validator.validatePagination, adminController.getFAQs);

// @route   POST /api/admin/faqs
// @desc    Create FAQ
// @access  Private (Admin)
router.post('/faqs', adminController.createFAQ);

// @route   PUT /api/admin/faqs/:id
// @desc    Update FAQ
// @access  Private (Admin)
router.put('/faqs/:id', validator.validateObjectId, adminController.updateFAQ);

// @route   DELETE /api/admin/faqs/:id
// @desc    Delete FAQ
// @access  Private (Admin)
router.delete('/faqs/:id', validator.validateObjectId, adminController.deleteFAQ);

// Fee Management
// @route   POST /api/admin/fees
// @desc    Create fee for student
// @access  Private (Admin)
router.post('/fees', validator.validateFee, adminController.createFee);

// AI / RAG Management
// @route   POST /api/admin/ai/sync-faqs
// @desc    Sync all active FAQs into Pinecone vector store
// @access  Private (Admin)
router.post('/ai/sync-faqs', adminController.syncFAQsToVectorStore);

// @route   GET /api/admin/ai/evaluation/demo
// @desc    Run demo RAGAS evaluation
// @access  Private (Admin)
router.get('/ai/evaluation/demo', adminController.runDemoEvaluation);

// @route   POST /api/admin/ai/evaluation
// @desc    Run custom RAGAS evaluation
// @access  Private (Admin)
router.post('/ai/evaluation', adminController.runEvaluation);

module.exports = router;
