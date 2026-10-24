import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  fingerprint: { type: String, required: true },
  result: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
export default mongoose.models.CreditOperation || mongoose.model('CreditOperation', schema);
