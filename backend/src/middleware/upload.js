const multer = require('multer');
const path = require('path');
const { AppError } = require('./errorHandler');

/**
 * File Upload Middleware
 * Handles document uploads for the knowledge base
 */

// Create upload directory if it doesn't exist
const uploadDir = process.env.UPLOAD_DIR || 'uploads';

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter
const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|txt|html|json)$/i;
const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/msword',                                                          // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',    // .docx
  'text/plain',                                                                  // .txt
  'text/html',                                                                   // .html
  'application/json',                                                            // .json
  'application/octet-stream',                                                    // fallback for some browsers
]);

const fileFilter = (req, file, cb) => {
  const extOk = ALLOWED_EXTENSIONS.test(path.extname(file.originalname));
  const mimeOk = ALLOWED_MIMETYPES.has(file.mimetype);

  if (extOk && mimeOk) {
    return cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only PDF, DOC, DOCX, TXT, HTML, and JSON files are allowed.', 400));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
  },
  fileFilter: fileFilter,
});

module.exports = upload;
