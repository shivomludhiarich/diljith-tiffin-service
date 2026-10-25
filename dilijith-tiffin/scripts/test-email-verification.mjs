import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { randomUUID } from 'node:crypto';
import EmailVerification from '../server/models/EmailVerification.js';
import AuthRate from '../server/models/AuthRate.js';
import User from '../server/models/User.js';
process.env.JWT_SECRET = randomUUID();
process.env.NODE_ENV = 'test';
process.env.GMAIL_SMTP_USER = 'sender@example.test';
process.env.GMAIL_SMTP_APP_PASSWORD = 'test-only-no-real-delivery';
const originalTransport = nodemailer.createTransport;
const sent = [];
let failMail = false;
nodemailer.createTransport = options => {
  assert.equal(options.host, 'smtp.gmail.com'); assert.equal(options.port, 465);
  assert.equal(options.secure, true); assert.equal(options.debug, false);
  return { async sendMail(message) {
    if (failMail) throw new Error('Private SMTP failure with credentials');
    sent.push(message); return { accepted: [message.to] };
  } };
};
const db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
let server;
try {
  await mongoose.connect(db.getUri(), { dbName: 'dts_test_email' });
  await Promise.all([EmailVerification.init(), User.init(), AuthRate.init()]);
  const { default: app } = await import('../server/app.js');
  server = app.listen(0); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://localhost:${server.address().port}/api/auth`;
  const request = async (path, body, origin = 'http://localhost:5173') => {
    const response = await fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  };
  const send = email => request('/email-verification/request', { email });
  const verify = (email, code) => request('/email-verification/verify', { email, code });
  const lastCode = () => sent.at(-1).text.match(/code is (\d{6})/)[1];
  const signup = { name: 'Verified customer', phone: '9876543210', email: 'customer@example.test', password: 'SafeSignup123', confirmPassword: 'SafeSignup123',
    address: { houseOrFlat: '1', street: 'Test Street', city: 'Manipal', state: 'Karnataka', postalCode: '576104', country: 'India' } };
  assert.equal((await request('/register', { ...signup, email: '' })).status, 400);
  assert.equal((await request('/register', signup)).status, 400);
  assert.equal(await User.countDocuments(), 0);
  assert.equal((await send('bad-address')).status, 400);
  const issuance = await send(' CUSTOMER@example.test ');
  assert.equal(issuance.status, 200); assert.equal(sent.at(-1).to, signup.email);
  assert.equal(issuance.data.code, undefined); assert.equal(issuance.cookie, null);
  const code = lastCode();
  const stored = await EmailVerification.findById(signup.email).select('+codeHash');
  assert.notEqual(stored.codeHash, code); assert.equal(stored.codeHash.length, 64);
  assert.equal((await verify('different@example.test', code)).status, 400);
  const accepted = await verify(signup.email, code);
  assert.equal(accepted.status, 200); assert.equal(accepted.cookie, null);
  assert.match(accepted.data.verificationToken, /^[a-f0-9]{64}$/);
  assert.equal((await verify(signup.email, code)).status, 400);
  assert.equal((await request('/register', { ...signup, email: 'different@example.test', verificationToken: accepted.data.verificationToken })).status, 400);
  const registrations = await Promise.all([request('/register', { ...signup, role: 'admin', verificationToken: accepted.data.verificationToken }),
    request('/register', { ...signup, verificationToken: accepted.data.verificationToken })]);
  assert.equal(registrations.filter(r => r.status === 201).length, 1);
  const created = await User.findOne({ email: signup.email }).select('+password');
  assert.equal(created.role, 'user'); assert.ok(created.emailVerifiedAt);
  assert.notEqual(created.password, signup.password); assert.ok(await created.matchPassword(signup.password));
  assert.equal(await EmailVerification.countDocuments({ _id: signup.email }), 0);
  assert.equal((await request('/login', { phone: signup.phone, password: signup.password })).status, 200);
  await AuthRate.deleteMany({});
  await send('expire@example.test'); const expireCode = lastCode();
  await EmailVerification.updateOne({ _id: 'expire@example.test' }, { $set: { expiresAt: new Date(0) } });
  assert.equal((await verify('expire@example.test', expireCode)).status, 400);
  await send('attempts@example.test'); const attemptsCode = lastCode();
  const wrong = attemptsCode === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await verify('attempts@example.test', wrong)).status, 400);
  assert.equal((await verify('attempts@example.test', attemptsCode)).status, 400);
  assert.equal((await EmailVerification.findById('attempts@example.test')).attempts, 5);
  await send('resend@example.test'); const firstGrant = await verify('resend@example.test', lastCode());
  await send('resend@example.test');
  assert.equal((await request('/register', { ...signup, phone: '9876543211', email: 'resend@example.test', verificationToken: firstGrant.data.verificationToken })).status, 400);
  const secondGrant = await verify('resend@example.test', lastCode());
  await EmailVerification.updateOne({ _id: 'resend@example.test' }, { $set: { expiresAt: new Date(0) } });
  assert.equal((await request('/register', { ...signup, phone: '9876543211', email: 'resend@example.test', verificationToken: secondGrant.data.verificationToken })).status, 400);
  await AuthRate.deleteMany({});
  for (let i = 0; i < 3; i++) assert.equal((await send('limit@example.test')).status, 200);
  assert.equal((await send('limit@example.test')).status, 429);
  failMail = true;
  const failed = await send('failure@example.test'); assert.equal(failed.status, 503);
  assert.doesNotMatch(JSON.stringify(failed.data), /Private|credentials|test-only/);
  assert.equal(await EmailVerification.countDocuments({ _id: 'failure@example.test' }), 0);
  failMail = false;
  delete process.env.GMAIL_SMTP_APP_PASSWORD;
  assert.equal((await send('unconfigured@example.test')).status, 503);
  assert.equal((await request('/email-verification/request', { email: signup.email }, 'https://hostile.example')).status, 403);
  // Existing customers need no migration or forced verification at login.
  await User.create({ name: 'Existing customer', phone: '+919876543299', password: 'Existing123' });
  assert.equal((await request('/login', { phone: '9876543299', password: 'Existing123' })).status, 200);
  console.log('Email verification passed: SMTP settings, no plaintext codes, required verification, expiry, attempt limits, resend invalidation, single-use concurrent signup, roles, hashing, phone login, delivery failures, rate limits and existing-account compatibility.');
} finally {
  nodemailer.createTransport = originalTransport;
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); await db.stop();
}
