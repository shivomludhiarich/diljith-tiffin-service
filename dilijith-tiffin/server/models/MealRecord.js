import mongoose from 'mongoose';

const mealRecordSchema = new mongoose.Schema(
  {
    accountingVersion: Number,
    accountingWarning: {
      reason: String,
      checkedAt: Date,
    },
    servingKey: String,
    recordCode: {
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
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true,
    },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner'],
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Consumed', 'Cancelled', 'Missed'],
      default: 'Scheduled',
      index: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: String,
      default: null, // 'user' | 'subscription' | 'admin'
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

mealRecordSchema.pre('validate', function () {
  if (this.accountingVersion === 2) this.servingKey = this.status === 'Cancelled' ? undefined : `${this.user}:${this.date}:${this.mealType}`;
});

// Prevent accidental duplicate meal schedule for the same subscription, date, and meal type
mealRecordSchema.index({ subscription: 1, date: 1, mealType: 1 }, { unique: true });

mealRecordSchema.index({ servingKey: 1 }, { unique: true, partialFilterExpression: { servingKey: { $type: 'string' } } });

export default mongoose.models.MealRecord || mongoose.model('MealRecord', mealRecordSchema);
