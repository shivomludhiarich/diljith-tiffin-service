import mongoose from 'mongoose';

const renewalSchema = new mongoose.Schema(
  {
    renewedAt: { type: Date, default: Date.now },
    durationMonths: { type: Number, required: true },
    addedMeals: { type: Number, required: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    subCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mealTypes: {
      type: [String],
      enum: ['breakfast', 'lunch', 'dinner'],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one meal type must be selected',
      },
    },
    durationMonths: {
      type: Number,
      required: true,
      enum: [1, 3, 6, 12],
    },
    startDate: {
      type: String, // YYYY-MM-DD
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'],
    },
    endDate: {
      type: String, // YYYY-MM-DD
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'],
    },
    allocatedMeals: {
      type: Number,
      required: true,
      min: [1, 'Allocated meals must be at least 1'],
    },
    consumedMeals: {
      type: Number,
      default: 0,
      min: [0, 'Consumed meals cannot be negative'],
    },
    approvedAdjustments: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Active', 'Expiring', 'Expired', 'Cancelled'],
      default: 'Active',
      index: true,
    },
    demoPrice: {
      type: Number,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      default: '',
    },
    replacedBy: {
      type: String,
      default: null,
    },
    renewals: [renewalSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

subscriptionSchema.virtual('remainingCredits').get(function () {
  return this.allocatedMeals - this.consumedMeals + this.approvedAdjustments;
});

export default mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
