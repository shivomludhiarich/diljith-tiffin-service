import { createHash, randomBytes } from 'node:crypto';
import { normalizeEmail, validEmail } from '../../src/utils/authValidation.js';
import { sendRecoveryLink } from '../services/signupEmail.js';
import User from '../models/User.js';
import { passwordError } from '../../src/utils/authValidation.js';
import { hashPassword } from '../utils/password.js';
import { withinRateLimit } from '../services/authRateLimit.js';

const invalid = res => res.status(400).json({ ok: false, code: 'INVALID_RESET_TOKEN', message: 'This reset link is invalid or has expired. Please request a new link.' });
const digest = token => createHash('sha256').update(token).digest('hex');
const limited = res => res.status(429).set('Retry-After', '60').json({ ok: false, message: 'Too many requests. Please wait and try again.' });

export async function forgotPassword(req, res) {
  try {
    if (!await withinRateLimit(`forgot-ip:${req.ip}`, 900000, 10)) return limited(res);
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ ok: false, message: 'Enter a valid email address.' });
    if (!await withinRateLimit(`forgot-email:${digest(email)}`, 900000, 3)) return limited(res);
    const origin = new URL(process.env.ALLOWED_ORIGIN || (process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : ''));
    if ((process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') || origin.href !== `${origin.origin}/` || !process.env.GMAIL_SMTP_USER || !process.env.GMAIL_SMTP_APP_PASSWORD?.trim()) throw new Error('Configuration unavailable');
    const token = randomBytes(32).toString('hex');
    const tokenHash = digest(token);
    const user = await User.findOneAndUpdate({ email, status: 'Active', emailVerifiedAt: { $type: 'date' } }, {
      $set: { resetTokenSource: 'email', resetTokenHash: tokenHash, resetTokenCreatedAt: new Date(), resetTokenExpiresAt: new Date(Date.now() + 1200000) },
    });
    if (user) {
      try { await sendRecoveryLink(email, `${origin.origin}/reset-password#token=${token}`); }
      catch {
        await User.updateOne({ _id: user._id, resetTokenHash: tokenHash }, { $unset: { resetTokenSource: '', resetTokenHash: '', resetTokenCreatedAt: '', resetTokenExpiresAt: '' } });
        // Keep account eligibility private and never log SMTP errors or secrets.
        console.error('[Password recovery] Email delivery failed.');
      }
    }
    res.json({ ok: true, message: 'If this is an active account with a verified email, we will attempt to send a reset link. Check your inbox and spam folder. If no email arrives, try requesting a new link later.' });
  } catch { res.status(503).json({ ok: false, message: 'Email recovery is unavailable. Please try again later.' }); }
}

export async function resetPassword(req, res) {
  try {
    if (!await withinRateLimit(`reset-ip:${req.ip}`, 60000, 10)) return limited(res);
    const { token, password, confirmPassword } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return invalid(res);
    const error = passwordError(password, confirmPassword);
    if (error) return res.status(400).json({ ok: false, message: error });
    const tokenHash = digest(token);
    if (!await withinRateLimit(`reset-token:${tokenHash}`, 60000, 5)) return limited(res);
    const hashedPassword = await hashPassword(password);
    // One document holds both credentials and the current reset grant, so one
    // atomic conditional update consumes it, changes the hash and revokes JWTs.
    const result = await User.updateOne({ resetTokenSource: 'email', resetTokenHash: tokenHash, resetTokenExpiresAt: { $gt: new Date() }, status: 'Active' }, {
      $set: { password: hashedPassword }, $inc: { tokenVersion: 1 },
      $unset: { resetTokenSource: '', resetTokenHash: '', resetTokenCreatedAt: '', resetTokenExpiresAt: '' },
    }, { runValidators: true });
    if (!result.modifiedCount) return invalid(res);
    res.json({ ok: true, message: 'Password updated. Log in with your new password.' });
  } catch {
    console.error('[Password recovery] Password update failed.');
    res.status(503).json({ ok: false, message: 'Could not reset your password. Please try again later.' });
  }
}
