import mongoose from 'mongoose';

const creditAdjustmentSchema = new mongoose.Schema(
  {
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please provide an adjustment amount'],
      validate: {
        validator: Number.isInteger,
        message: 'Adjustment amount must be a whole integer',
      },
    },
    reason: {
      type: String,
      required: [true, 'Please provide a reason for credit adjustment'],
      trim: true,
    },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', null],
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.CreditAdjustment || mongoose.model('CreditAdjustment', creditAdjustmentSchema);
