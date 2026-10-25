import mongoose from 'mongoose';
import EmailVerification from '../models/EmailVerification.js';
import { grantDigest } from './emailVerificationController.js';
import User from '../models/User.js';
import { setSessionCookie } from '../middleware/sessionCookie.js';
import { generateToken } from '../middleware/auth.js';
import { normalizePhone, validatePhone } from '../utils/phone.js';
import { normalizeEmail, validEmail, passwordError } from '../../src/utils/authValidation.js';


// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

/** Normalise + validate an address object from req.body. Returns { address, errors }. */
function normalizeAddress(raw) {
  if (!raw || typeof raw !== 'object') {
    return { address: null, errors: { address: 'Delivery address is required.' } };
  }

  const houseOrFlat = String(raw.houseOrFlat || '').trim();
  const street      = String(raw.street      || '').trim();
  const area        = String(raw.area        || '').trim();
  const city        = String(raw.city        || '').trim();
  const state       = String(raw.state       || '').trim();
  const postalCode  = String(raw.postalCode  || '').trim();
  const country     = String(raw.country     || 'India').trim();

  const errors = {};
  if (!houseOrFlat) errors.houseOrFlat = 'House / flat number is required.';
  if (!street)      errors.street      = 'Street / locality is required.';
  if (!city)        errors.city        = 'City is required.';
  if (!state)       errors.state       = 'State is required.';
  if (!postalCode)  errors.postalCode  = 'PIN code is required.';
  else if (country === 'India' && !/^\d{6}$/.test(postalCode))
    errors.postalCode = 'Indian PIN codes must be exactly 6 digits.';

  if (Object.keys(errors).length) return { address: null, errors };
  return { address: { houseOrFlat, street, area, city, state, postalCode, country }, errors: {} };
}

/** Safe user shape returned to all clients (never exposes password). */
function serializeUser(u) {
  return {
    id:      u._id.toString(),
    name:    u.name,
    phone:   u.phone,
    email:   u.email || null,
    role:    u.role,
    status:  u.status,
    address: u.address ?? null,
  };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function register(req, res) {
  try {
    const { name, phone, email, password, confirmPassword, countryCode = '+91', address: rawAddress } = req.body;

    // --- Basic field validation ---
    if (!name || !name.trim())
      return res.status(400).json({ ok: false, field: 'name', message: 'Full name is required.' });

    if (!phone || !String(phone).trim())
      return res.status(400).json({ ok: false, field: 'phone', message: 'Phone number is required.' });

    const phoneCheck = validatePhone(phone, countryCode);
    if (!phoneCheck.valid)
      return res.status(400).json({ ok: false, field: 'phone', message: phoneCheck.message });
    const normalizedPhone = phoneCheck.normalized;

    if (typeof password !== 'string')
      return res.status(400).json({ ok: false, field: 'password', message: 'Password is required.' });
    if (password.length < 6)
      return res.status(400).json({ ok: false, field: 'password', message: 'Password must be at least 6 characters.' });
    if (confirmPassword !== undefined && password !== confirmPassword)
      return res.status(400).json({ ok: false, field: 'confirmPassword', message: 'Passwords do not match.' });

    const policyError = passwordError(password, confirmPassword ?? password);
    if (policyError) return res.status(400).json({ ok: false, field: 'password', message: policyError });

    // --- Address validation (server-side, never trust client alone) ---
    const { address, errors: addrErrors } = normalizeAddress(rawAddress);
    if (Object.keys(addrErrors).length) {
      const [firstField, firstMsg] = Object.entries(addrErrors)[0];
      return res.status(400).json({ ok: false, field: firstField, message: firstMsg, addressErrors: addrErrors });
    }

    // --- Duplicate check ---
    const existing = await User.findOne({ phone: normalizedPhone });
    if (existing)
      return res.status(409).json({ ok: false, field: 'phone', message: 'An account with this phone number already exists.' });

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !validEmail(normalizedEmail)) return res.status(400).json({ ok: false, field: 'email', message: 'Enter a valid email address.' });
    if (normalizedEmail && await User.exists({ email: normalizedEmail })) return res.status(409).json({ ok: false, field: 'email', message: 'An account with this email already exists.' });

    // --- Create user (role always 'user', never trusted from request body) ---
    const verificationToken = req.body.verificationToken;
    if (typeof verificationToken !== 'string' || !/^[a-f0-9]{64}$/.test(verificationToken)) return res.status(400).json({ ok: false, field: 'email', message: 'Verify your email before signing up.' });
    let user;
    await mongoose.connection.transaction(async session => {
      const grant = await EmailVerification.findOneAndDelete({ _id: normalizedEmail, verified: true,
        grantHash: grantDigest(verificationToken), expiresAt: { $gt: new Date() } }, { session });
      if (!grant) throw Object.assign(new Error('Email verification expired or was already used. Please verify again.'), { status: 400, field: 'email' });
      [user] = await User.create([{
      name: name.trim(),
      phone: normalizedPhone,
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      password,
      role: 'user',
      status: 'Active',
      emailVerifiedAt: new Date(),
      address,
      }], { session });
    });

    const token = generateToken(user);
    setSessionCookie(res, token);
    res.status(201).json({ ok: true, user: serializeUser(user), message: 'Account created successfully!' });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ ok: false, field: error.field, message: error.message });
    if (error.code === 11000)
      return res.status(409).json({ ok: false, field: error.keyPattern?.email ? 'email' : 'phone', message: 'An account with these details already exists.' });
    res.status(500).json({ ok: false, message: error.message || 'Registration failed.' });
  }
}

export async function login(req, res) {
  try {
    const { phone, email, identifier, password, countryCode = '+91' } = req.body;
    const rawTarget = phone || identifier || email;

    if (!rawTarget || !String(rawTarget).trim())
      return res.status(400).json({ ok: false, field: 'phone', message: 'Please enter your phone number.' });
    if (!password)
      return res.status(400).json({ ok: false, field: 'password', message: 'Please enter your password.' });

    const trimmed    = String(rawTarget).trim();
    const normalized = normalizePhone(trimmed, countryCode);

    const user = await User.findOne({
      $or: [{ phone: normalized }, { phone: trimmed }, { email: trimmed.toLowerCase() }],
    }).select('+password');

    // Generic message to prevent account enumeration
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ ok: false, message: 'Invalid phone number or password.' });

    if (user.status !== 'Active')
      return res.status(403).json({ ok: false, message: 'Your account is inactive or suspended. Please contact customer support.' });

    const token = generateToken(user);
    setSessionCookie(res, token);
    res.json({ ok: true, user: serializeUser(user), message: 'Logged in successfully.' });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || 'Login failed.' });
  }
}

export async function getMe(req, res) {
  res.json({ ok: true, user: serializeUser(req.user) });
}

/** Update the authenticated user's own delivery address. */
export async function updateAddress(req, res) {
  try {
    const { address: rawAddress } = req.body;
    const { address, errors: addrErrors } = normalizeAddress(rawAddress);
    if (Object.keys(addrErrors).length) {
      const [firstField, firstMsg] = Object.entries(addrErrors)[0];
      return res.status(400).json({ ok: false, field: firstField, message: firstMsg, addressErrors: addrErrors });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { address } },
      { new: true, runValidators: true }
    );

    res.json({ ok: true, address: user.address, message: 'Delivery address updated.' });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || 'Could not update address.' });
  }
}

