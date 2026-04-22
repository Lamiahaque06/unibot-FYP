const { User, Course, Document, FAQ, Fee, Enrollment } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const aiService = require('../services/aiService');

/**
 * Admin Controller
 * Handles administrative operations
 */

/**
 * @desc    Get admin dashboard statistics
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin)
 */
const getDashboard = asyncHandler(async (req, res, next) => {
  // Get counts
  const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
  const totalCourses = await Course.countDocuments({ status: 'active' });
  const totalDocuments = await Document.countDocuments({ status: 'active' });
  const totalFAQs = await FAQ.countDocuments({ status: 'active' });

  // Get recent enrollments
  const recentEnrollments = await Enrollment.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('student', 'email profile')
    .populate('course', 'courseCode courseName');

  // Get fee statistics
  const feeStats = await Fee.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
      },
    },
  ]);

  // Get course enrollment statistics
  const courseStats = await Course.aggregate([
    {
      $match: { status: 'active' },
    },
    {
      $group: {
        _id: '$department',
        courseCount: { $sum: 1 },
        totalEnrollment: { $sum: '$currentEnrollment' },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalStudents,
        totalCourses,
        totalDocuments,
        totalFAQs,
      },
      recentEnrollments,
      feeStats,
      courseStats,
    },
  });
});

/**
 * @desc    Get all users with filtering
 * @route   GET /api/admin/users
 * @access  Private (Admin)
 */
const getUsers = asyncHandler(async (req, res, next) => {
  const { role, isActive, search, page = 1, limit = 20 } = req.query;

  const query = {};
  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { 'profile.firstName': { $regex: search, $options: 'i' } },
      { 'profile.lastName': { $regex: search, $options: 'i' } },
      { 'profile.studentId': { $regex: search, $options: 'i' } },
    ];
  }

  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const count = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    data: users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  });
});

/**
 * @desc    Get all courses with filtering
 * @route   GET /api/admin/courses
 * @access  Private (Admin)
 */
const getCourses = asyncHandler(async (req, res, next) => {
  const { department, semester, year, status, page = 1, limit = 20 } = req.query;

  const query = {};
  if (department) query.department = department;
  if (semester) query.semester = semester;
  if (year) query.year = parseInt(year);
  if (status) query.status = status;

  const courses = await Course.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const count = await Course.countDocuments(query);

  res.status(200).json({
    success: true,
    data: courses,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  });
});

/**
 * @desc    Create new course
 * @route   POST /api/admin/courses
 * @access  Private (Admin)
 */
const createCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.create(req.body);

  logger.info(`Course created: ${course.courseCode} by admin ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Course created successfully',
    data: course,
  });
});

/**
 * @desc    Update course
 * @route   PUT /api/admin/courses/:id
 * @access  Private (Admin)
 */
const updateCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  Object.assign(course, req.body);
  await course.save();

  logger.info(`Course updated: ${course.courseCode} by admin ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Course updated successfully',
    data: course,
  });
});

/**
 * @desc    Delete course
 * @route   DELETE /api/admin/courses/:id
 * @access  Private (Admin)
 */
const deleteCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  // Check if course has active enrollments
  const enrollmentCount = await Enrollment.countDocuments({
    course: course._id,
    status: 'enrolled',
  });

  if (enrollmentCount > 0) {
    return next(
      new AppError(`Cannot delete course with ${enrollmentCount} active enrollments`, 400)
    );
  }

  course.status = 'inactive';
  await course.save();

  logger.info(`Course deactivated: ${course.courseCode} by admin ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Course deactivated successfully',
  });
});

/**
 * @desc    Upload document and trigger AI embedding pipeline (UC3)
 * @route   POST /api/admin/documents
 * @access  Private (Admin)
 */
const uploadDocument = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload a file', 400));
  }

  const { title, description, category, tags } = req.body;
  const tagList = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  // 1. Create document record (status: processing)
  const document = await Document.create({
    title: title || req.file.originalname,
    description,
    fileName: req.file.originalname,
    filePath: req.file.path,
    fileType: path.extname(req.file.originalname).substring(1).toLowerCase(),
    fileSize: req.file.size,
    category: category || 'general',
    tags: tagList,
    uploadedBy: req.user._id,
    status: 'processing',
  });

  logger.info(`Document uploaded: ${document.title} (${document._id}) by admin ${req.user.email}`);

  // 2. Respond immediately so admin isn't blocked waiting for embedding
  res.status(201).json({
    success: true,
    message: 'Document uploaded — embedding pipeline triggered',
    data: document,
  });

  // 3. Trigger AI embedding pipeline asynchronously (non-blocking)
  setImmediate(async () => {
    try {
      const absolutePath = path.resolve(document.filePath);
      const result = await aiService.processDocument({
        documentId: document._id.toString(),
        documentName: document.title,
        filePath: absolutePath,
        category: document.category,
        tags: document.tags,
      });

      // 4. Update document status in MongoDB
      document.status = result.status === 'processed' ? 'active' : 'error';
      document.embedding = {
        isProcessed: result.status === 'processed',
        chunksCount: result.chunks_created || 0,
        vectorsCount: result.vectors_upserted || 0,
        processedAt: new Date(),
      };
      await document.save();

      logger.info(
        `Document '${document.title}' embedding complete: ` +
        `${result.chunks_created} chunks, ${result.vectors_upserted} vectors`
      );
    } catch (err) {
      logger.error(`Document embedding pipeline failed for ${document._id}: ${err.message}`);
      document.status = 'error';
      await document.save();
    }
  });
});

/**
 * @desc    Get all documents
 * @route   GET /api/admin/documents
 * @access  Private (Admin)
 */
const getDocuments = asyncHandler(async (req, res, next) => {
  const { category, status, page = 1, limit = 20 } = req.query;

  const query = {};
  if (category) query.category = category;
  if (status) query.status = status;

  const documents = await Document.find(query)
    .populate('uploadedBy', 'email profile.firstName profile.lastName')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const count = await Document.countDocuments(query);

  res.status(200).json({
    success: true,
    data: documents,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  });
});

/**
 * @desc    Delete document
 * @route   DELETE /api/admin/documents/:id
 * @access  Private (Admin)
 */
const deleteDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(new AppError('Document not found', 404));
  }

  // Delete file from filesystem
  try {
    await fs.unlink(document.filePath);
  } catch (error) {
    logger.error(`Error deleting file: ${error.message}`);
  }

  // Remove vectors from Pinecone
  try {
    await aiService.deleteDocumentVectors(document._id.toString());
    logger.info(`Vectors deleted for document: ${document._id}`);
  } catch (err) {
    logger.warn(`Could not delete vectors: ${err.message}`);
  }

  // Delete document record
  await document.deleteOne();

  logger.info(`Document deleted: ${document.title} by admin ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Document deleted successfully',
  });
});

/**
 * @desc    Get all FAQs
 * @route   GET /api/admin/faqs
 * @access  Private (Admin)
 */
const getFAQs = asyncHandler(async (req, res, next) => {
  const { category, status, page = 1, limit = 20 } = req.query;

  const query = {};
  if (category) query.category = category;
  if (status) query.status = status;

  const faqs = await FAQ.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const count = await FAQ.countDocuments(query);

  res.status(200).json({
    success: true,
    data: faqs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  });
});

/**
 * @desc    Create FAQ
 * @route   POST /api/admin/faqs
 * @access  Private (Admin)
 */
const createFAQ = asyncHandler(async (req, res, next) => {
  const faq = await FAQ.create({
    ...req.body,
    createdBy: req.user._id,
  });

  logger.info(`FAQ created by admin ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'FAQ created successfully',
    data: faq,
  });
});

/**
 * @desc    Update FAQ
 * @route   PUT /api/admin/faqs/:id
 * @access  Private (Admin)
 */
const updateFAQ = asyncHandler(async (req, res, next) => {
  const faq = await FAQ.findById(req.params.id);

  if (!faq) {
    return next(new AppError('FAQ not found', 404));
  }

  Object.assign(faq, req.body);
  faq.updatedBy = req.user._id;
  await faq.save();

  logger.info(`FAQ updated by admin ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'FAQ updated successfully',
    data: faq,
  });
});

/**
 * @desc    Delete FAQ
 * @route   DELETE /api/admin/faqs/:id
 * @access  Private (Admin)
 */
const deleteFAQ = asyncHandler(async (req, res, next) => {
  const faq = await FAQ.findById(req.params.id);

  if (!faq) {
    return next(new AppError('FAQ not found', 404));
  }

  await faq.deleteOne();

  logger.info(`FAQ deleted by admin ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'FAQ deleted successfully',
  });
});

/**
 * @desc    Create fee for student
 * @route   POST /api/admin/fees
 * @access  Private (Admin)
 */
const createFee = asyncHandler(async (req, res, next) => {
  const fee = await Fee.create(req.body);

  logger.info(`Fee created for student by admin ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Fee created successfully',
    data: fee,
  });
});

/**
 * @desc    Sync all active FAQs into the Pinecone vector store
 * @route   POST /api/admin/ai/sync-faqs
 * @access  Private (Admin)
 */
const syncFAQsToVectorStore = asyncHandler(async (req, res, next) => {
  const faqs = await FAQ.find({ status: 'active' }).lean();

  if (faqs.length === 0) {
    return res.status(200).json({ success: true, message: 'No active FAQs to sync', synced: 0 });
  }

  try {
    const result = await aiService.ingestFAQs(faqs);
    logger.info(`Synced ${result.faqs_ingested} FAQs to vector store`);
    res.status(200).json({
      success: true,
      message: `Successfully synced ${result.faqs_ingested} FAQs to Pinecone`,
      data: result,
    });
  } catch (err) {
    logger.error(`FAQ sync failed: ${err.message}`);
    return next(new AppError(`FAQ sync failed: ${err.message}`, 500));
  }
});

/**
 * @desc    Run demo RAGAS evaluation
 * @route   GET /api/admin/ai/evaluation/demo
 * @access  Private (Admin)
 */
const runDemoEvaluation = asyncHandler(async (req, res, next) => {
  try {
    const result = await aiService.runDemoEvaluation();
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(new AppError(`Evaluation failed: ${err.message}`, 500));
  }
});

/**
 * @desc    Run custom RAGAS evaluation
 * @route   POST /api/admin/ai/evaluation
 * @access  Private (Admin)
 */
const runEvaluation = asyncHandler(async (req, res, next) => {
  const { samples } = req.body;
  if (!samples || !Array.isArray(samples) || samples.length === 0) {
    return next(new AppError('samples array is required', 400));
  }
  try {
    const result = await aiService.runEvaluation(samples);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(new AppError(`Evaluation failed: ${err.message}`, 500));
  }
});

module.exports = {
  getDashboard,
  getUsers,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  uploadDocument,
  getDocuments,
  deleteDocument,
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  createFee,
  syncFAQsToVectorStore,
  runDemoEvaluation,
  runEvaluation,
};
