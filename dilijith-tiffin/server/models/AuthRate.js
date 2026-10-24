import mongoose from 'mongoose';
const schema = new mongoose.Schema({ _id: String, count: Number, expiresAt: { type: Date, expires: 0 } });
export default mongoose.models.AuthRate || mongoose.model('AuthRate', schema);
