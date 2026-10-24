import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  booking: mongoose.Schema.Types.ObjectId,
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner'], required: true },
  delta: { type: Number, required: true, validate: Number.isSafeInteger },
  operation: { type: String, required: true },
  operationKey: { type: String, required: true },
  actor: mongoose.Schema.Types.ObjectId,
  reason: String,
  expiresOn: String,
  previousExpiry: String,
}, { timestamps: true });
schema.index({ operationKey: 1, mealType: 1 }, { unique: true });
export default mongoose.models.CreditLedger || mongoose.model('CreditLedger', schema);
