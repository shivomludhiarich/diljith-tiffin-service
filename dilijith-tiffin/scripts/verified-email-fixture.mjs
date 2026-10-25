// Existing account tests use an already-verified email fixture. The separate
// email verification suite exercises real HTTP code issuance and verification.
import { randomBytes, createHash } from 'node:crypto';
import EmailVerification from '../server/models/EmailVerification.js';
export async function withVerifiedEmail(body) {
  body.email ||= `${String(body.phone).replace(/\D/g, '')}@example.test`;
  const email = body.email.trim().toLowerCase();
  const token = randomBytes(32).toString('hex');
  await EmailVerification.findOneAndUpdate({ _id: email }, { $set: {
    verified: true, grantHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 600000),
  } }, { upsert: true });
  return { ...body, verificationToken: token };
}
