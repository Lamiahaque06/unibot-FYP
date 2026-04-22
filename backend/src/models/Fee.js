const mongoose = require('mongoose');

/**
 * Fee Schema
 * Manages student fee payments and outstanding dues
 * Tracks payment history and deadlines
 */

const feeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required'],
    },
    // Fee details
    feeType: {
      type: String,
      enum: ['tuition', 'hostel', 'library', 'laboratory', 'examination', 'registration', 'other'],
      required: [true, 'Fee type is required'],
    },
    description: {
      type: String,
      required: [true, 'Fee description is required'],
    },
    // Amount information
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
    },
    // Academic period
    semester: {
      type: String,
      enum: ['Fall', 'Spring', 'Summer'],
      required: [true, 'Semester is required'],
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
    // Due date
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    // Payment status
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue', 'waived'],
      default: 'pending',
    },
    // Payment history
    payments: [
      {
        amount: {
          type: Number,
          required: true,
        },
        paymentDate: {
          type: Date,
          default: Date.now,
        },
        paymentMethod: {
          type: String,
          enum: ['cash', 'card', 'bank_transfer', 'online', 'cheque'],
        },
        transactionId: {
          type: String,
        },
        remarks: {
          type: String,
        },
      },
    ],
    // Late fee
    lateFee: {
      type: Number,
      default: 0,
    },
    // Waiver information
    waiver: {
      isWaived: {
        type: Boolean,
        default: false,
      },
      waiverAmount: {
        type: Number,
        default: 0,
      },
      waiverReason: {
        type: String,
      },
      waivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      waiverDate: {
        type: Date,
      },
    },
    // Reminder tracking
    remindersSent: {
      type: Number,
      default: 0,
    },
    lastReminderDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
feeSchema.index({ student: 1, status: 1 });
feeSchema.index({ dueDate: 1 });
feeSchema.index({ semester: 1, year: 1 });

/**
 * Calculate remaining balance
 * @returns {number} - Outstanding amount
 */
feeSchema.methods.getRemainingBalance = function () {
  return Math.max(0, this.amount + this.lateFee - this.paidAmount - this.waiver.waiverAmount);
};

/**
 * Check if fee is overdue
 * @returns {boolean} - True if overdue
 */
feeSchema.methods.isOverdue = function () {
  const now = new Date();
  return this.status !== 'paid' && this.status !== 'waived' && this.dueDate < now;
};

/**
 * Get days until due date (negative if overdue)
 * @returns {number} - Days until/past due date
 */
feeSchema.methods.getDaysUntilDue = function () {
  const now = new Date();
  const diffTime = this.dueDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Update fee status based on payment
 */
feeSchema.methods.updateStatus = async function () {
  const remaining = this.getRemainingBalance();

  if (this.waiver.isWaived && remaining === 0) {
    this.status = 'waived';
  } else if (remaining === 0) {
    this.status = 'paid';
  } else if (this.paidAmount > 0) {
    this.status = 'partial';
  } else if (this.isOverdue()) {
    this.status = 'overdue';
  } else {
    this.status = 'pending';
  }

  await this.save();
};

/**
 * Add a payment
 * @param {Object} paymentData - Payment information
 */
feeSchema.methods.addPayment = async function (paymentData) {
  this.payments.push(paymentData);
  this.paidAmount += paymentData.amount;
  await this.updateStatus();
};

/**
 * Pre-save middleware to update status
 */
feeSchema.pre('save', function (next) {
  // Check if overdue
  if (this.isOverdue() && this.status === 'pending') {
    this.status = 'overdue';
  }
  next();
});

const Fee = mongoose.model('Fee', feeSchema);

module.exports = Fee;
