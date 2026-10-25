import { createHash, createHmac, randomInt, randomBytes } from 'node:crypto';
import EmailVerification from '../models/EmailVerification.js';
import { withinRateLimit } from '../services/authRateLimit.js';
import { normalizeEmail, validEmail } from '../../src/utils/authValidation.js';
import { sendSignupCode } from '../services/signupEmail.js';
export const grantDigest = token => createHash('sha256').update(token).digest('hex');
const codeDigest = (email, code) => createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${code}`).digest('hex');
const limited = res => res.status(429).set('Retry-After', '900').json({ ok: false, message: 'Too many attempts. Please wait 15 minutes before trying again.' });
const invalid = res => res.status(400).json({ ok: false, message: 'Invalid or expired verification code. Request a new code if needed.' });

export async function requestEmailVerification(req, res) {
  let email, codeHash;
  try {
    if (!await withinRateLimit(`verify-email-send-ip:${req.ip}`, 900000, 10)) return limited(res);
    email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
    if (!validEmail(email) || email.length > 254) return res.status(400).json({ ok: false, message: 'Enter a valid email address.' });
    if (!await withinRateLimit(`verify-email-send:${email}`, 900000, 3)) return limited(res);
    if (!process.env.GMAIL_SMTP_USER || !process.env.GMAIL_SMTP_APP_PASSWORD || !process.env.JWT_SECRET) {
      return res.status(503).json({ ok: false, message: 'Email verification is not configured yet. Please contact the service team.' });
    }
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    codeHash = codeDigest(email, code);
    await EmailVerification.findOneAndUpdate({ _id: email }, {
      $set: { codeHash, attempts: 0, verified: false, expiresAt: new Date(Date.now() + 600000) },
      $unset: { grantHash: '' },
    }, { upsert: true });
    await sendSignupCode(email, code);
    res.json({ ok: true, message: 'Verification email submitted. Check your inbox and spam folder. The code expires in 10 minutes.' });
  } catch {
    if (email && codeHash) await EmailVerification.deleteOne({ _id: email, codeHash }).catch(() => {});
    res.status(503).json({ ok: false, message: 'Could not send the verification email. Please try again later.' });
  }
}

export async function verifyEmailCode(req, res) {
  try {
    if (!await withinRateLimit(`verify-email-check-ip:${req.ip}`, 900000, 30)) return limited(res);
    const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
    const code = req.body?.code;
    if (!validEmail(email) || typeof code !== 'string' || !/^\d{6}$/.test(code)) return invalid(res);
    const challenge = await EmailVerification.findOneAndUpdate({ _id: email, verified: false, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() } },
      { $inc: { attempts: 1 } }, { returnDocument: 'after' }).select('+codeHash');
    if (!challenge || challenge.codeHash !== codeDigest(email, code)) return invalid(res);
    const verificationToken = randomBytes(32).toString('hex');
    const result = await EmailVerification.updateOne({ _id: email, codeHash: challenge.codeHash, verified: false, expiresAt: { $gt: new Date() } },
      { $set: { verified: true, grantHash: grantDigest(verificationToken), expiresAt: new Date(Date.now() + 600000) }, $unset: { codeHash: '' } });
    if (!result.modifiedCount) return invalid(res);
    res.json({ ok: true, verificationToken, message: 'Email verified. Complete signup within 10 minutes.' });
  } catch { res.status(503).json({ ok: false, message: 'Email verification is temporarily unavailable.' }); }
}
