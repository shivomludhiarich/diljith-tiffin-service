import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: String, // Normalized email; one active challenge per address.
  codeHash: { type: String, select: false },
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  grantHash: { type: String, select: false },
  expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.models.EmailVerification || mongoose.model('EmailVerification', schema);
