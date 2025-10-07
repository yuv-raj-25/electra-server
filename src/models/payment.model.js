import mongoose, { Schema, model } from "mongoose";

const paymentSchema = new Schema({
  paymentId: {
    type: String,
    unique: true,
    uppercase: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, 'User ID is required'],
    index: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    index: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ChargingSession",
    index: true
  },
  paymentType: {
    type: String,
    enum: {
      values: ['booking', 'charging', 'wallet-topup', 'subscription', 'penalty'],
      message: '{VALUE} is not a valid payment type'
    },
    required: true,
    default: 'booking'
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: "INR",
    uppercase: true,
    enum: {
      values: ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'],
      message: '{VALUE} is not a supported currency'
    }
  },
  breakdown: {
    baseAmount: {
      type: Number,
      min: 0
    }, 
    tax: {
      type: Number,
      default: 0,
      min: 0
    },
    serviceFee: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    couponDiscount: {
      type: Number,
      default: 0,
      min: 0
    },
    convenienceFee: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  status: {
    type: String,
    enum: {
      values: [
        'initiated',
        'pending',
        'processing',
        'success',
        'failed',
        'cancelled',
        'refunded',
        'partial-refund',
        'expired'
      ],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'pending',
    index: true
  },
  
  paymentMethod: {
    type: String,
    enum: {
      values: [
        'card',
        'debit-card',
        'credit-card',
        'upi',
        'netbanking',
        'wallet',
        'emi',
        'pay-later'
      ],
      message: '{VALUE} is not a valid payment method'
    },
    required: true
  },
  
  provider: {
    name: {
      type: String,
      required: [true, 'Payment provider is required'],
      enum: {
        values: ['razorpay', 'stripe', 'paytm', 'phonepe', 'gpay', 'paypal'],
        message: '{VALUE} is not a supported payment provider'
      }
    },
    
    paymentId: {
      type: String,
      required: [true, 'Provider payment ID is required'],
      index: true
    },
    
    orderId: {
      type: String,
      index: true
    },
    
    signature: {
      type: String
    }
  },
  
  cardDetails: {
    lastFourDigits: {
      type: String,
      validate: {
        validator: function(value) {
          if (!value) return true;
          return /^\d{4}$/.test(value);
        },
        message: 'Last four digits must be exactly 4 numbers'
      }
    },
    
    cardType: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'rupay', 'discover', 'diners']
    },
    
    cardNetwork: String,
    
    bank: String,
    
    country: String,
    
    isInternational: {
      type: Boolean,
      default: false
    }
  },
  
  upiDetails: {
    vpa: {
      type: String,
      lowercase: true
    },
    
    transactionId: String
  },
  
  walletDetails: {
    walletProvider: {
      type: String,
      enum: ['paytm', 'phonepe', 'gpay', 'amazon-pay', 'mobikwik', 'freecharge']
    },
    
    walletTransactionId: String
  },
  
  refund: {
    isRefunded: {
      type: Boolean,
      default: false
    },
    
    refundAmount: {
      type: Number,
      min: 0
    },
    
    refundId: String,
    
    refundReason: {
      type: String,
      maxlength: 500
    },
    
    refundStatus: {
      type: String,
      enum: ['initiated', 'processing', 'completed', 'failed']
    },
    
    refundInitiatedAt: Date,
    
    refundCompletedAt: Date,
    
    refundInitiatedBy: {
      type: String,
      enum: ['user', 'admin', 'system']
    }
  },
  
  timestamps: {
    initiatedAt: {
      type: Date,
      default: Date.now
    },
    
    processingAt: Date,
    
    completedAt: Date,
    
    failedAt: Date,
    
    expiresAt: Date
  },
  
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    
    verificationMethod: {
      type: String,
      enum: ['otp', '3ds', 'pin', 'biometric', 'none']
    },
    
    verifiedAt: Date
  },
  
  fraud: {
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    
    isFlagged: {
      type: Boolean,
      default: false
    },
    
    flagReason: String,
    
    verificationRequired: {
      type: Boolean,
      default: false
    }
  },
  
  billing: {
    name: {
      type: String,
      trim: true
    },
    
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    
    phone: {
      type: String,
      trim: true
    },
    
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    }
  },
  
  invoice: {
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    
    invoiceUrl: String,
    
    generatedAt: Date,
    
    emailSent: {
      type: Boolean,
      default: false
    }
  },
  
  metadata: {
    ipAddress: String,
    
    userAgent: String,
    
    deviceType: String,
    
    location: {
      city: String,
      state: String,
      country: String
    },
    
    retryCount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    referenceId: String,
    
    notes: String
  },
  
  errors: [{
    code: String,
    message: String,
    description: String,
    occurredAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  webhookEvents: [{
    event: String,
    payload: mongoose.Schema.Types.Mixed,
    receivedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  settlement: {
    isSettled: {
      type: Boolean,
      default: false
    },
    
    settlementId: String,
    
    settledAt: Date,
    
    settlementAmount: Number,
    
    fees: {
      gatewayFee: Number,
      gst: Number,
      totalFees: Number
    }
  },
  
  coupon: {
    code: {
      type: String,
      uppercase: true
    },
    
    discountAmount: {
      type: Number,
      min: 0
    },
    
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100
    }
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ 'provider.paymentId': 1 });
paymentSchema.index({ 'provider.orderId': 1 });
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ bookingId: 1 });

// Pre-save middleware to generate payment ID
paymentSchema.pre('save', function(next) {
  if (!this.paymentId) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 8).toUpperCase();
    this.paymentId = `PAY-${date}-${random}`;
  }
  next();
});

// Pre-save middleware to generate invoice number
paymentSchema.pre('save', function(next) {
  if (this.status === 'success' && !this.invoice.invoiceNumber) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    this.invoice.invoiceNumber = `INV-${date}-${random}`;
    this.invoice.generatedAt = new Date();
  }
  next();
});

// Pre-save middleware to update timestamps
paymentSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    
    switch(this.status) {
      case 'processing':
        if (!this.timestamps.processingAt) {
          this.timestamps.processingAt = now;
        }
        break;
      case 'success':
        if (!this.timestamps.completedAt) {
          this.timestamps.completedAt = now;
        }
        break;
      case 'failed':
        if (!this.timestamps.failedAt) {
          this.timestamps.failedAt = now;
        }
        break;
    }
  }
  next();
});

// Virtual for payment status display
paymentSchema.virtual('statusDisplay').get(function() {
  return this.status.charAt(0).toUpperCase() + this.status.slice(1).replace(/-/g, ' ');
});

// Virtual for amount display
paymentSchema.virtual('amountDisplay').get(function() {
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AUD: 'A$',
    CAD: 'C$'
  };
  const symbol = symbols[this.currency] || this.currency;
  return `${symbol}${this.amount.toFixed(2)}`;
});

// Virtual for refund amount display
paymentSchema.virtual('refundAmountDisplay').get(function() {
  if (!this.refund.refundAmount) return 'N/A';
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£'
  };
  const symbol = symbols[this.currency] || this.currency;
  return `${symbol}${this.refund.refundAmount.toFixed(2)}`;
});

// Method to check if payment is successful
paymentSchema.methods.isSuccessful = function() {
  return this.status === 'success';
};

// Method to check if payment can be refunded
paymentSchema.methods.canBeRefunded = function() {
  return this.status === 'success' && !this.refund.isRefunded;
};

// Method to initiate refund
paymentSchema.methods.initiateRefund = function(amount, reason, initiatedBy = 'user') {
  if (!this.canBeRefunded()) {
    throw new Error('Payment cannot be refunded');
  }
  
  const refundAmount = amount || this.amount;
  
  if (refundAmount > this.amount) {
    throw new Error('Refund amount cannot exceed payment amount');
  }
  
  this.refund = {
    isRefunded: true,
    refundAmount,
    refundReason: reason,
    refundStatus: 'initiated',
    refundInitiatedAt: new Date(),
    refundInitiatedBy: initiatedBy
  };
  
  if (refundAmount === this.amount) {
    this.status = 'refunded';
  } else {
    this.status = 'partial-refund';
  }
};

// Method to mark payment as failed
paymentSchema.methods.markAsFailed = function(errorCode, errorMessage) {
  this.status = 'failed';
  this.timestamps.failedAt = new Date();
  
  this.errors.push({
    code: errorCode,
    message: errorMessage,
    occurredAt: new Date()
  });
};

// Method to add webhook event
paymentSchema.methods.addWebhookEvent = function(event, payload) {
  this.webhookEvents.push({
    event,
    payload,
    receivedAt: new Date()
  });
};

// Method to calculate net amount (after fees)
paymentSchema.methods.calculateNetAmount = function() {
  const gatewayFee = this.amount * 0.02; // 2% gateway fee
  const gst = gatewayFee * 0.18; // 18% GST on gateway fee
  const totalFees = gatewayFee + gst;
  
  return {
    grossAmount: this.amount,
    gatewayFee: parseFloat(gatewayFee.toFixed(2)),
    gst: parseFloat(gst.toFixed(2)),
    totalFees: parseFloat(totalFees.toFixed(2)),
    netAmount: parseFloat((this.amount - totalFees).toFixed(2))
  };
};

// Static method to find payments by user
paymentSchema.statics.findByUser = function(userId, status = null) {
  const query = { userId };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find successful payments in date range
paymentSchema.statics.findSuccessfulPayments = function(startDate, endDate) {
  const query = {
    status: 'success',
    'timestamps.completedAt': {}
  };
  
  if (startDate) query['timestamps.completedAt'].$gte = startDate;
  if (endDate) query['timestamps.completedAt'].$lte = endDate;
  
  return this.find(query).sort({ 'timestamps.completedAt': -1 });
};

// Static method to calculate total revenue
paymentSchema.statics.calculateRevenue = async function(startDate, endDate, currency = 'INR') {
  const query = {
    status: 'success',
    currency
  };
  
  if (startDate || endDate) {
    query['timestamps.completedAt'] = {};
    if (startDate) query['timestamps.completedAt'].$gte = startDate;
    if (endDate) query['timestamps.completedAt'].$lte = endDate;
  }
  
  const result = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalTransactions: { $sum: 1 },
        averageTransaction: { $avg: '$amount' }
      }
    }
  ]);
  
  return result[0] || {
    totalRevenue: 0,
    totalTransactions: 0,
    averageTransaction: 0
  };
};

// Static method to find pending payments older than X minutes
paymentSchema.statics.findExpiredPayments = function(minutes = 15) {
  const expiryTime = new Date(Date.now() - minutes * 60 * 1000);
  return this.find({
    status: { $in: ['initiated', 'pending'] },
    'timestamps.initiatedAt': { $lte: expiryTime }
  });
};

export const Payment = model("Payment", paymentSchema);