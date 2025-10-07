import { Schema, model } from "mongoose";


const chargingSessionSchema = new Schema({

  sessionCode: {
    type: String,
    unique: true,
    uppercase: true,
    index: true
  },
  
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: [true, 'Booking ID is required'],
    index: true
  }, 
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, 'User ID is required'],
    index: true
  },
  stationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Station",
    required: [true, 'Station ID is required'],
    index: true
  },
  status: {
    type: String,
    enum: {
      values: [
        'initiated',
        'authenticating',
        'starting',
        'charging',
        'paused',
        'resuming',
        'stopping',
        'completed',
        'failed',
        'interrupted',
        'timeout'
      ],
      message: '{VALUE} is not a valid session status'
    },
    default: 'initiated',
    index: true
  },
   chargingData: {
    initialSOC: {
      type: Number, // State of Charge percentage at start
      min: 0,
      max: 100,
      required: true
    }, 
    currentSOC: {
      type: Number, // Current State of Charge percentage
      min: 0,
      max: 100
    },
    
    targetSOC: {
      type: Number, // Target State of Charge percentage
      min: 0,
      max: 100,
      required: true
    },
    
    finalSOC: {
      type: Number, // Final State of Charge percentage
      min: 0,
      max: 100
    },
    
    kWhConsumed: {
      type: Number,
      default: 0,
      min: 0
    },
    
    currentPower: {
      type: Number, // Current power in kW
      default: 0,
      min: 0
    },
    
    maxPower: {
      type: Number, // Maximum power delivered in kW
      default: 0,
      min: 0
    },
    
    averagePower: {
      type: Number, // Average power in kW
      default: 0,
      min: 0
    },
    
    voltage: {
      type: Number, // in Volts
      min: 0
    },
    
    current: {
      type: Number, // in Amperes
      min: 0
    },
    
    temperature: {
      type: Number, // Battery temperature in Celsius
    },
    
    chargingCurve: [{
      timestamp: Date,
      soc: Number,
      power: Number,
      voltage: Number,
      current: Number
    }]
  },
  
  kWhConsumed: { type: Number, default: 0 },
  durationMinutes: Number,
  totalCost: Number,

  
}, { timestamps: true });



// Indexes for efficient queries
chargingSessionSchema.index({ userId: 1, 'timing.startedAt': -1 });
chargingSessionSchema.index({ stationId: 1, status: 1 });
chargingSessionSchema.index({ sessionCode: 1 });
chargingSessionSchema.index({ status: 1, 'timing.startedAt': -1 });




// Virtual for session progress percentage
chargingSessionSchema.virtual('progressPercentage').get(function() {
  const initial = this.chargingData.initialSOC || 0;
  const current = this.chargingData.currentSOC || initial;
  const target = this.chargingData.targetSOC || 100;
  
  if (target <= initial) return 100;
  return Math.min(((current - initial) / (target - initial) * 100), 100).toFixed(2);
});

// Virtual for cost per kWh
chargingSessionSchema.virtual('actualCostPerKWh').get(function() {
  if (this.chargingData.kWhConsumed > 0 && this.pricing.totalCost) {
    return (this.pricing.totalCost / this.chargingData.kWhConsumed).toFixed(4);
  }
  return 0;
});

// Method to pause session
chargingSessionSchema.methods.pauseSession = function(reason) {
  if (this.status === 'charging') {
    this.status = 'paused';
    this.timing.pauseDurations.push({
      pausedAt: new Date(),
      reason: reason || 'User requested'
    });
  }
};

// Method to resume session
chargingSessionSchema.methods.resumeSession = function() {
  if (this.status === 'paused') {
    this.status = 'charging';
    const lastPause = this.timing.pauseDurations[this.timing.pauseDurations.length - 1];
    if (lastPause) {
      lastPause.resumedAt = new Date();
    }
  }
};

// Method to complete session
chargingSessionSchema.methods.completeSession = function(terminatedBy = 'user', reason = 'Charging complete') {
  this.status = 'completed';
  this.timing.endedAt = new Date();
  this.chargingData.finalSOC = this.chargingData.currentSOC;
  this.termination = {
    terminatedBy,
    reason,
    wasSuccessful: true
  };
};



// Method to calculate estimated time remaining
chargingSessionSchema.methods.calculateEstimatedTimeRemaining = function() {
  const currentSOC = this.chargingData.currentSOC || this.chargingData.initialSOC;
  const targetSOC = this.chargingData.targetSOC;
  const averagePower = this.chargingData.averagePower || this.chargingData.currentPower;
  const batteryCapacity = this.vehicleInfo.batteryCapacity;
  
  if (!averagePower || !batteryCapacity || currentSOC >= targetSOC) {
    return 0;
  }
  
  const remainingEnergy = (targetSOC - currentSOC) / 100 * batteryCapacity;
  const remainingMinutes = (remainingEnergy / averagePower) * 60;
  
  return Math.round(remainingMinutes);
};

// Static method to calculate total energy consumption
chargingSessionSchema.statics.getTotalEnergyConsumed = async function(userId, startDate, endDate) {
  const query = { userId, status: 'completed' };
  
  if (startDate || endDate) {
    query['timing.startedAt'] = {};
    if (startDate) query['timing.startedAt'].$gte = startDate;
    if (endDate) query['timing.startedAt'].$lte = endDate;
  }
  
  const result = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalEnergy: { $sum: '$chargingData.kWhConsumed' },
        totalCost: { $sum: '$pricing.totalCost' },
        totalSessions: { $sum: 1 },
        totalCO2Saved: { $sum: '$carbonOffset.co2Saved' }
      }
    }
  ]);
  
  return result[0] || {
    totalEnergy: 0,
    totalCost: 0,
    totalSessions: 0,
    totalCO2Saved: 0
  };
};

export const ChargingSession = model("ChargingSession", chargingSessionSchema);