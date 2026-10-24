import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { authThrottle, AUTH_LIMITS } from '../server/middleware/authThrottle.js';
import AuthRate from '../server/models/AuthRate.js';
const db = await MongoMemoryServer.create();
const originalNow = Date.now;
try {
  await mongoose.connect(db.getUri(), { dbName: 'dts_test_throttle' });
  await AuthRate.init();
  let now = 1800000000000;
  Date.now = () => now;
  async function attempt(action, ip, body) {
    const result = { status: 200, headers: {} };
    const res = { status(n) { result.status = n; return this; }, set(k,v) { result.headers[k] = v; return this; }, json(body) { result.body = body; return this; } };
    await authThrottle(action)({ ip, body }, res, () => { result.allowed = true; });
    return result;
  }
  for (const action of ['login', 'register']) {
    const policy = AUTH_LIMITS[action];
    for (let i=0;i<policy.account;i++) assert.equal((await attempt(action, `ip-${i}`, { phone: '9876543210' })).allowed, true);
    const blocked = await attempt(action, 'new-ip', { phone: '+91 9876543210' });
    assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers['Retry-After']) > 0);
    now += policy.duration;
    assert.equal((await attempt(action, 'new-ip', { phone: '9876543210' })).allowed, true);
    await AuthRate.deleteMany({});
    for (let i=0;i<policy.ip;i++) assert.equal((await attempt(action, 'shared-ip', { email: `person${i}@example.test` })).allowed, true);
    assert.equal((await attempt(action, 'shared-ip', { email: 'fresh@example.test' })).status, 429);
    await AuthRate.deleteMany({});
  }
  const concurrent = await Promise.all(Array.from({length: 15}, (_,i) => attempt('login', `parallel-${i}`, { email: i%2 ? ' CUSTOMER@example.test ' : 'customer@example.test' })));
  assert.equal(concurrent.filter(r => r.allowed).length, 10);
  console.log('Auth throttling passed: IP/account limits, normalized identifiers, concurrency, Retry-After and automatic expiry.');
} finally { Date.now = originalNow; await mongoose.disconnect(); await db.stop(); }
