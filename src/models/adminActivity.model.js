// models/adminActivity.model.js
import mongoose, { Schema, model } from 'mongoose';

const adminActivitySchema = new Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Admin ID is required'],
    index: true
  },
  
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: {
      values: [
        'create',
        'update',
        'delete',
        'approve',
        'reject',
        'suspend',
        'activate',
        'deactivate',
        'refund',
        'cancel',
        'export-data',
        'login',
        'logout',
        'view',
        'download'
      ],
      message: '{VALUE} is not a valid action type'
    },
    index: true
  },
  
  targetModel: {
    type: String,
    required: [true, 'Target model is required'],
    enum: {
      values: [
        'User',
        'Station',
        'Booking',
        'Payment',
        'ChargingSession',
        'Charger',
        'Review'
      ],
      message: '{VALUE} is not a valid target model'
    },
    index: true
  },
  
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Target ID is required'],
    index: true
  },
  
  targetName: {
    type: String,
    trim: true
    // Human-readable name like station name, user email, etc.
  },
  
  changes: {
    before: {
      type: mongoose.Schema.Types.Mixed,
      // Stores the state before the change
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      // Stores the state after the change
    }
  },
  
  reason: {
    type: String,
    maxlength: [500, 'Reason cannot exceed 500 characters'],
    trim: true
  },
  
  ipAddress: {
    type: String,
    trim: true,
    validate: {
      validator: function(value) {
        if (!value) return true;
        // Basic IP validation (supports IPv4 and IPv6)
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$/;
        return ipv4Regex.test(value) || ipv6Regex.test(value);
      },
      message: 'Invalid IP address format'
    }
  },
  
  userAgent: {
    type: String,
    trim: true
    // Browser/device information
  },
  
  location: {
    city: String,
    state: String,
    country: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    // Additional custom data specific to the action
    default: {}
  },
  
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success'
  },
  
  errorMessage: {
    type: String,
    maxlength: 1000
    // If action failed, store error details
  },
  
  duration: {
    type: Number,
    // Time taken to complete the action in milliseconds
    min: 0
  },
  
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
    // Importance level of the action
  }
  
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
adminActivitySchema.index({ adminId: 1, createdAt: -1 });
adminActivitySchema.index({ targetModel: 1, targetId: 1 });
adminActivitySchema.index({ action: 1, createdAt: -1 });
adminActivitySchema.index({ createdAt: -1 });
adminActivitySchema.index({ severity: 1, createdAt: -1 });

// Virtual for formatted timestamp
adminActivitySchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleString();
});

// Virtual for action description
adminActivitySchema.virtual('actionDescription').get(function() {
  const actionMap = {
    'create': 'created',
    'update': 'updated',
    'delete': 'deleted',
    'approve': 'approved',
    'reject': 'rejected',
    'suspend': 'suspended',
    'activate': 'activated',
    'deactivate': 'deactivated',
    'refund': 'refunded',
    'cancel': 'cancelled'
  };
  
  const actionText = actionMap[this.action] || this.action;
  return `${actionText} ${this.targetModel}${this.targetName ? ': ' + this.targetName : ''}`;
});

// Method to get changed fields
adminActivitySchema.methods.getChangedFields = function() {
  if (!this.changes || !this.changes.before || !this.changes.after) {
    return [];
  }
  
  const before = this.changes.before;
  const after = this.changes.after;
  const changedFields = [];
  
  Object.keys(after).forEach(key => {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedFields.push({
        field: key,
        oldValue: before[key],
        newValue: after[key]
      });
    }
  });
  
  return changedFields;
};

// Static method to log activity
adminActivitySchema.statics.logActivity = async function(data) {
  try {
    const activity = await this.create(data);
    return activity;
  } catch (error) {
    console.error('Failed to log admin activity:', error);
    // Don't throw error to prevent breaking the main operation
    return null;
  }
};

// Static method to get activities by admin
adminActivitySchema.statics.getByAdmin = function(adminId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    action,
    targetModel,
    startDate,
    endDate
  } = options;
  
  const query = { adminId };
  
  if (action) query.action = action;
  if (targetModel) query.targetModel = targetModel;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('adminId', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get activities for a specific target
adminActivitySchema.statics.getByTarget = function(targetModel, targetId, limit = 20) {
  return this.find({ targetModel, targetId })
    .populate('adminId', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get recent activities
adminActivitySchema.statics.getRecent = function(limit = 50) {
  return this.find()
    .populate('adminId', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get critical activities
adminActivitySchema.statics.getCriticalActivities = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    severity: 'critical',
    createdAt: { $gte: startDate }
  })
    .populate('adminId', 'firstName lastName email role')
    .sort({ createdAt: -1 });
};

// Static method to get activity statistics
adminActivitySchema.statics.getStatistics = async function(startDate, endDate) {
  const query = {};
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const [totalActivities, actionBreakdown, modelBreakdown, topAdmins] = await Promise.all([
    // Total activities
    this.countDocuments(query),
    
    // Activities by action type
    this.aggregate([
      { $match: query },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Activities by target model
    this.aggregate([
      { $match: query },
      { $group: { _id: '$targetModel', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Most active admins
    this.aggregate([
      { $match: query },
      { $group: { _id: '$adminId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'admin'
        }
      },
      { $unwind: '$admin' },
      {
        $project: {
          adminId: '$_id',
          adminName: { $concat: ['$admin.firstName', ' ', '$admin.lastName'] },
          adminEmail: '$admin.email',
          activityCount: '$count'
        }
      }
    ])
  ]);
  
  return {
    totalActivities,
    actionBreakdown,
    modelBreakdown,
    topAdmins
  };
};

// TTL index to automatically delete old logs after 90 days (optional)
// adminActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export const AdminActivity = model('AdminActivity', adminActivitySchema);