import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
process.env.JWT_SECRET = randomUUID();
const db = await MongoMemoryServer.create();
let server;
try {
  await mongoose.connect(db.getUri(), { dbName: 'dts_test_recovery' });
  const { default: User } = await import('../server/models/User.js');
  const { default: app } = await import('../server/app.js');
  await User.init();
  const user = await User.create({ name: 'Recovery test', phone: '+919876543210', email: 'test@example.test', password: 'Original123', role: 'user' });
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const post = async (route, body) => {
    const response = await fetch(`http://localhost:${server.address().port}/api/auth/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const { generateToken } = await import('../server/middleware/auth.js');
  const admin = await User.create({ name: 'Admin', phone: '+919876543211', password: 'AdminTest123', role: 'admin' });
  const oldSession = generateToken(user);
  const token = randomBytes(32).toString('hex');
  const reference = createHash('sha256').update(token).digest('hex');
  async function approve(id, jwt) {
    return fetch(`http://localhost:${server.address().port}/api/admin/users/${id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) }, body: JSON.stringify({ reference, identityVerified: true, role: 'admin' }) });
  }
  assert.equal((await approve(user.id)).status, 401);
  assert.equal((await approve(user.id, oldSession)).status, 403);
  assert.equal((await approve('invalid', generateToken(admin))).status, 400);
  assert.equal((await approve(admin.id, generateToken(admin))).status, 404);
  const approval = await approve(user.id, generateToken(admin));
  assert.equal(approval.status, 200);
  assert.ok(!(await approval.text()).includes(token));
  await User.updateOne({ _id: user.id }, { $set: { resetTokenExpiresAt: new Date(0) } });
  assert.equal((await post('reset-password', { token, password: 'Replacement123', confirmPassword: 'Replacement123' })).status, 400);
  assert.equal((await approve(user.id, generateToken(admin))).status, 200);
  const stored = await User.findById(user.id).select('+resetTokenHash');
  assert.notEqual(stored.resetTokenHash, token);
  const payload = { token, password: 'Replacement123', confirmPassword: 'Replacement123' };
  const results = await Promise.all([post('reset-password', payload), post('reset-password', payload)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal((await post('reset-password', payload)).status, 400);
  assert.equal((await post('login', { phone: user.phone, password: 'Replacement123' })).status, 200);
  assert.equal((await post('login', { phone: user.phone, password: 'Original123' })).status, 401);
  const updated = await User.findById(user.id).select('+password +resetTokenHash');
  assert.equal(updated.role, 'user'); assert.equal(updated.tokenVersion, 1);
  assert.equal(updated.resetTokenHash, undefined); assert.notEqual(updated.password, payload.password);
  assert.equal(updated.phone, user.phone); assert.equal(updated.email, user.email); assert.equal(updated.name, user.name);
  const sessionCheck = await fetch(`http://localhost:${server.address().port}/api/auth/me`, { headers: { Authorization: `Bearer ${oldSession}` } });
  assert.equal(sessionCheck.status, 401);
  console.log('Admin recovery checks passed: authorization, IDs, expiry, hashing, concurrent use, replay, phone login, session revocation and preserved customer data.');
} finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await db.stop(); }
