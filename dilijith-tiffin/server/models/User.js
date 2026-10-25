import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { hashPassword } from '../utils/password.js';

const addressSchema = new mongoose.Schema(
  {
    houseOrFlat: { type: String, trim: true, default: '' },
    street:      { type: String, trim: true, default: '' },
    area:        { type: String, trim: true, default: '' },
    city:        { type: String, trim: true, default: '' },
    state:       { type: String, trim: true, default: '' },
    postalCode:  { type: String, trim: true, default: '' },
    country:     { type: String, trim: true, default: 'India' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    emailVerifiedAt: { type: Date, default: null },
    creditRevision: { type: Number, default: 0, select: false },
    tokenVersion: { type: Number, default: 0 },
    resetTokenHash: { type: String, select: false },
    resetTokenCreatedAt: { type: Date, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Please provide a phone number'],
      unique: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Prevents accidental exposure in queries
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Suspended'],
      default: 'Active',
    },
    address: {
      type: addressSchema,
      default: null, // null = address not yet provided (pre-feature users)
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

userSchema.index({ resetTokenHash: 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await hashPassword(this.password);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.models.User || mongoose.model('User', userSchema);
