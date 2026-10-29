import { setTestNow } from './fixed-service-test-clock.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { todayStr, addDays } from '../src/utils/dates.js';
process.env.JWT_SECRET = randomUUID();
const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
let server;
try {
  await mongoose.connect(repl.getUri(), { dbName: 'dts_test_credit_api' });
  const { default: app } = await import('../server/app.js');
  // Legacy explicit-consumption fixtures predate the automatic-accounting activation.
  await mongoose.connection.db.collection('mealaccountingpolicies').updateOne({ _id: 'automatic-consumption-v1' }, { $set: { activatedAt: new Date('2099-01-01') } }, { upsert: true });
  const { generateToken } = await import('../server/middleware/auth.js');
  const { default: User } = await import('../server/models/User.js');
  const { default: Subscription } = await import('../server/models/Subscription.js');
  const { default: MealRecord } = await import('../server/models/MealRecord.js');
  const { default: Ledger } = await import('../server/models/CreditLedger.js');
  const { default: Operation } = await import('../server/models/CreditOperation.js');
  const { default: Adjustment } = await import('../server/models/CreditAdjustment.js');
  const { default: Activity } = await import('../server/models/Activity.js');
  await Promise.all([User, Subscription, MealRecord, Ledger, Operation, Adjustment, Activity].map(m => m.init()));
  const admin = await User.create({ name: 'Test admin', phone: '9000000001', password: randomUUID(), role: 'admin' });
  const user = await User.create({ name: 'Test user', phone: '9000000002', password: randomUUID() });
  const other = await User.create({ name: 'Other user', phone: '9000000003', password: randomUUID() });
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, actor = admin) {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Cookie: `__Host-dts-session=${generateToken(actor)}`, Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  const today = todayStr();
  const allocate = (meal, n, extra = {}) => request('/admin/subscriptions/allocate', { userId: String(user._id), durationMonths: 1, startDate: today, mealTypes: [meal], mealAllocations: { [meal]: n }, opId: randomUUID(), ...extra });
  const subs = {};
  for (const meal of ['breakfast', 'lunch', 'dinner']) {
    const result = await allocate(meal, 3);
    assert.equal(result.data.ok, true, JSON.stringify(result));
    subs[meal] = result.data.subscription;
    assert.equal(subs[meal].balances[meal].remaining, 3);
  }
  assert.equal((await allocate('lunch', 30, { mealTypes: ['lunch', 'dinner'], mealAllocations: { lunch: 30, dinner: 30 } })).status, 400);
  const records = await MealRecord.find({ user: user._id });
  const lunch = records.find(r => r.mealType === 'lunch' && r.date === today);
  const delivery = { opId: randomUUID() };
  const delivered = await request(`/admin/meals/${lunch._id}/consume`, delivery);
  assert.equal(delivered.data.subscription.balances.lunch.remaining, 2);
  assert.equal((await request(`/admin/meals/${lunch._id}/consume`, delivery)).data.ok, true);
  assert.equal((await request(`/admin/meals/${lunch._id}/consume`, { opId: randomUUID() })).status, 409);
  assert.equal(await Ledger.countDocuments({ booking: lunch._id, operation: 'consumption' }), 1);
  const dinner = records.find(r => r.mealType === 'dinner' && r.date === addDays(today, 1));
  assert.equal((await request(`/user/meals/${dinner._id}/cancel`, { opId: randomUUID() }, other)).status, 404);
  const upcoming = await request(`/user/meals/today?date=${addDays(today, 1)}`, null, user);
  assert.equal(upcoming.status, 200);
  assert.ok(upcoming.data.meals.every(m => m.date === addDays(today, 1)));
  assert.ok(upcoming.data.meals.find(m => m.mealType === 'dinner').entries.some(e => e._id === String(dinner._id) && e.cancellable));
  const otherUpcoming = await request(`/user/meals/today?date=${addDays(today, 1)}`, null, other);
  assert.ok(otherUpcoming.data.meals.every(m => m.entries.length === 0));
  assert.equal((await request('/user/meals/today?date=invalid', null, user)).status, 400);
  const cancellation = { opId: randomUUID() };
  assert.equal((await request(`/user/meals/${dinner._id}/cancel`, cancellation, user)).data.ok, true);
  assert.equal((await request(`/user/meals/${dinner._id}/cancel`, cancellation, user)).data.ok, true);
  assert.equal((await request(`/user/meals/${dinner._id}/cancel`, { opId: randomUUID() }, user)).status, 409);
  assert.equal((await Subscription.findById(subs.dinner._id)).mealCredits.dinner.consumed, 0);
  assert.equal(await Ledger.countDocuments({ booking: dinner._id }), 1);
  assert.equal((await request(`/admin/subscriptions/${subs.lunch.id}/adjust`, { amount: 1, reason: 'Unauthorized', mealType: 'lunch', opId: randomUUID() }, user)).status, 403);
  const adjust = (type, n, extra = {}) => request(`/admin/subscriptions/${subs[type].id}/adjust`, { mealType: type, amount: n, reason: 'Test correction', opId: randomUUID(), ...extra });
  assert.equal((await adjust('lunch', -3)).status, 409);
  assert.equal((await adjust('lunch', 1, { mealType: 'dinner' })).status, 400);
  const adjustments = await Promise.all(Array.from({ length: 5 }, () => adjust('lunch', -1)));
  assert.equal(adjustments.filter(r => r.data.ok).length, 2, JSON.stringify(adjustments));
  assert.equal((await Subscription.findById(subs.lunch._id)).remainingCredits, 0);
  // A second eligible date with no credit must not be consumed.
  const emptyMeal = await MealRecord.create({ user: user._id, subscription: subs.lunch._id, mealType: 'lunch', date: addDays(today, -1), status: 'Scheduled', accountingVersion: 2 });
  await Subscription.updateOne({ _id: subs.lunch._id }, { $set: { startDate: addDays(today, -2) } });
  assert.equal((await request(`/admin/meals/${emptyMeal._id}/consume`, { opId: randomUUID() })).status, 409);
  // Concurrency on the same booking: only one debit commits.
  const breakfast = records.find(r => r.mealType === 'breakfast' && r.date === today);
  const concurrent = await Promise.all(Array.from({ length: 6 }, () => request(`/admin/meals/${breakfast._id}/consume`, { opId: randomUUID() })));
  assert.equal(concurrent.filter(r => r.data.ok).length, 1);
  assert.equal((await Subscription.findById(subs.breakfast._id)).remainingCredits, 2);
  // Move expiry only in this disposable fixture; renewal retains unused dinner credits.
  await Subscription.updateOne({ _id: subs.dinner._id }, { $set: { endDate: today } });
  const renewal = { opId: randomUUID() };
  const renewed = await request(`/admin/subscriptions/${subs.dinner.id}/renew`, renewal);
  assert.equal(renewed.data.subscription.balances.dinner.remaining, 33, JSON.stringify(renewed));
  await request(`/admin/subscriptions/${subs.dinner.id}/renew`, renewal);
  assert.equal((await Subscription.findById(subs.dinner._id)).remainingCredits, 33);
  const dashboard = await request('/user/dashboard', undefined, user);
  assert.equal(dashboard.data.summary.mealCredits.breakfast.remaining, 2);
  assert.equal(dashboard.data.summary.mealCredits.lunch.remaining, 0);
  assert.equal(dashboard.data.summary.mealCredits.dinner.remaining, 33);
  for (const sub of await Subscription.find({ user: user._id })) {
    const ledger = await Ledger.find({ subscription: sub._id });
    assert.equal(ledger.reduce((sum, row) => sum + row.delta, 0), sub.remainingCredits);
  }
  const conflict = await allocate('breakfast', 5);
  assert.equal(conflict.data.needsConfirm, true);
  const before = await Subscription.countDocuments();
  const same = { opId: randomUUID(), confirmReplace: true };
  const repeated = await Promise.all([allocate('breakfast', 5, same), allocate('breakfast', 5, same)]);
  assert.ok(repeated.every(r => r.data.ok), JSON.stringify(repeated));
  assert.equal(await Subscription.countDocuments(), before + 1);
  // Unique serving key across subscriptions, even if a caller bypasses the API.
  await assert.rejects(MealRecord.create({ user: user._id, subscription: subs.lunch._id, mealType: 'breakfast', date: today, accountingVersion: 2 }), /duplicate key/);
  const legacy = await Subscription.create({ user: other._id, mealTypes: ['lunch', 'dinner'], durationMonths: 1, startDate: today, endDate: addDays(today, 20), allocatedMeals: 60 });
  assert.equal((await request(`/admin/subscriptions/${legacy._id}/adjust`, { mealType: 'lunch', amount: 1, reason: 'Legacy', opId: randomUUID() })).status, 409);
  assert.equal((await Subscription.findById(legacy._id)).allocatedMeals, 60);
  assert.equal((await request('/admin/state')).data.state.users.some(u => 'password' in u), false);
  // Distinct bookings compete for the same last credit.
  const lastSub = repeated[0].data.subscription;
  await request(`/admin/subscriptions/${lastSub.id}/adjust`, { mealType: 'breakfast', amount: -4, reason: 'Last credit', opId: randomUUID() });
  await Subscription.updateOne({ _id: lastSub._id }, { $set: { startDate: addDays(today, -2) } });
  const competing = await MealRecord.create([1, 2].map(n => ({ user: user._id, subscription: lastSub._id, date: addDays(today, -n), mealType: 'breakfast', accountingVersion: 2 })));
  const spent = await Promise.all(competing.map(r => request(`/admin/meals/${r._id}/consume`, { opId: randomUUID() })));
  assert.equal(spent.filter(r => r.data.ok).length, 1);
  assert.equal((await Subscription.findById(lastSub._id)).remainingCredits, 0);
  // Failure after updating the cache must roll the transaction back.
  const beforeRollback = (await Subscription.findById(subs.dinner._id)).remainingCredits;
  const createLedger = Ledger.create;
  Ledger.create = async () => { throw new Error('Injected ledger write failure'); };
  try { assert.equal((await adjust('dinner', 1)).status, 500); } finally { Ledger.create = createLedger; }
  assert.equal((await Subscription.findById(subs.dinner._id)).remainingCredits, beforeRollback);
  // Exercise migration against actual MongoDB, including safe rerun and history retention.
  const single = await Subscription.create({ user: other._id, mealTypes: ['breakfast'], durationMonths: 1, startDate: today, endDate: addDays(today, 20), allocatedMeals: 5, consumedMeals: 1, approvedAdjustments: 2 });
  const historical = await MealRecord.create({ user: other._id, subscription: single._id, mealType: 'breakfast', date: today, status: 'Consumed' });
  const snapshot = {
    subscriptions: await Subscription.collection.find({ _id: { $in: [single._id, legacy._id] } }).toArray(),
    mealRecords: await MealRecord.collection.find({ user: other._id }).toArray(),
  };
  const backupFile = path.join(os.tmpdir(), `dts-credit-test-${randomUUID()}.json`);
  await fs.writeFile(backupFile, JSON.stringify(snapshot));
  try {
    for (let i = 0; i < 2; i++) {
      const child = spawn(process.execPath, ['scripts/migrate-single-meal-credits.mjs', backupFile, '--apply'], {
        env: { ...process.env, CREDIT_MIGRATION_URI: repl.getUri(), CREDIT_MIGRATION_DB: 'dts_test_credit_api' }, stdio: 'inherit', windowsHide: true,
      });
      assert.equal(await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); }), 0);
    }
  } finally { await fs.unlink(backupFile); }
  const migrated = await Subscription.findById(single._id);
  assert.equal(migrated.accountingVersion, 2);
  assert.equal(migrated.mealCredits.breakfast.allocated, 5);
  assert.equal(migrated.mealCredits.breakfast.consumed, 1);
  assert.equal(migrated.remainingCredits, 6);
  assert.equal(await Ledger.countDocuments({ subscription: single._id, operation: 'migration_opening' }), 1);
  assert.equal((await MealRecord.findById(historical._id)).status, 'Consumed');
  assert.equal((await Subscription.findById(legacy._id)).accountingVersion, undefined);
  assert.equal((await User.findById(other._id)).name, 'Other user');
  const weekendUser = await User.create({ name: 'Weekend test', phone: '9000000009', password: randomUUID() });
  const weekend = await request('/admin/subscriptions/allocate', { userId: String(weekendUser._id), durationMonths: 1,
    startDate: '2026-10-24', mealTypes: ['dinner'], mealAllocations: { dinner: 5 }, opId: randomUUID() });
  assert.equal(weekend.status, 201);
  const weekendSub = weekend.data.subscription._id;
  const bookings = await MealRecord.find({ subscription: weekendSub }).sort({ date: 1 });
  assert.deepEqual(bookings.map(m => m.date), ['2026-10-24', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']);
  const oldSunday = await MealRecord.create({ user: weekendUser._id, subscription: weekendSub, accountingVersion: 2,
    date: '2026-10-25', mealType: 'dinner' });
  assert.equal((await request(`/user/meals/${oldSunday._id}/cancel`, { opId: randomUUID() }, weekendUser)).status, 409);
  assert.equal((await request(`/admin/meals/${oldSunday._id}/consume`, { opId: randomUUID() })).status, 409);
  assert.equal((await request('/admin/meals/summary?date=2026-10-25')).data.total, 0);
  assert.deepEqual((await request('/admin/meals/deliveries?date=2026-10-25&mealType=dinner')).data.deliveries, []);
  assert.equal((await MealRecord.findById(oldSunday._id)).status, 'Scheduled');
  assert.equal(await Ledger.countDocuments({ booking: oldSunday._id }), 0);
  setTestNow('2026-10-25T08:00:00+05:30');
  const sundayView = await request('/user/meals/today', null, weekendUser);
  assert.equal(sundayView.status, 200);
  assert.ok(sundayView.data.meals.every(m => m.serviceDay === false && m.entries.length === 0 && m.status === 'No service on Sundays'));
  await MealRecord.updateOne({ _id: oldSunday._id }, { $set: { status: 'Consumed' } });
  const sundayHistory = await request('/user/meals/recent', null, weekendUser);
  const historyRow = sundayHistory.data.meals.find(m => m._id === String(oldSunday._id));
  assert.equal(historyRow.status, 'No service on Sundays');
  assert.equal(historyRow.creditReviewRequired, true);
  assert.equal((await MealRecord.findById(oldSunday._id)).status, 'Consumed');
  await MealRecord.updateOne({ _id: oldSunday._id }, { $set: { status: 'Scheduled' } });
  const sundayMetrics = await request('/admin/dashboard');
  assert.deepEqual(sundayMetrics.data.metrics.prep, { breakfast: 0, lunch: 0, dinner: 0 });
  setTestNow('2026-10-22T00:00:00+05:30');
  assert.equal((await request(`/admin/subscriptions/${weekendSub}/cancel`, { opId: randomUUID() })).data.ok, true);
  assert.equal((await MealRecord.findById(oldSunday._id)).status, 'Scheduled');
  console.log('Sunday API checks passed: allocation skips Sunday, legacy Sunday mutations rejected, no Sunday deliveries.');
  // Credit lifetime: no end date, cancellation extends service, Sundays stay off,
  // and the automatic worker stops exactly at the available credit balance.
  setTestNow('2026-10-24T08:00:00+05:30');
  const lifetimeUser = await User.create({ name: 'Lifetime test', phone: '9000000010', password: randomUUID() });
  const lifetime = await request('/admin/subscriptions/allocate', { userId: String(lifetimeUser._id), durationMonths: 1,
    startDate: '2026-10-24', mealTypes: ['dinner'], mealAllocations: { dinner: 2 }, opId: randomUUID() });
  assert.equal(lifetime.status, 201);
  assert.equal(lifetime.data.subscription.endDate, null);
  const lifetimeId = lifetime.data.subscription._id;
  assert.equal((await Subscription.findById(lifetimeId)).endDate, undefined);
  await Subscription.updateOne({ _id: lifetimeId }, { $set: { endDate: '2026-10-24' } }); // historical field must be ignored
  const firstDinner = await MealRecord.findOne({ subscription: lifetimeId, date: '2026-10-24' });
  const cancelPayload = { opId: randomUUID() };
  assert.equal((await request(`/user/meals/${firstDinner._id}/cancel`, cancelPayload, lifetimeUser)).status, 200);
  assert.equal((await request(`/user/meals/${firstDinner._id}/cancel`, cancelPayload, lifetimeUser)).status, 200);
  assert.deepEqual((await MealRecord.find({ subscription: lifetimeId, status: 'Scheduled' }).sort({ date: 1 })).map(r => r.date), ['2026-10-26', '2026-10-27']);
  assert.equal((await Subscription.findById(lifetimeId)).remainingCredits, 2);
  const { settleDueMeals } = await import('../server/services/automaticConsumption.js');
  const { deriveSubStatus } = await import('../server/controllers/adminController.js');
  await mongoose.connection.db.collection('mealaccountingpolicies').updateOne({ _id: 'automatic-consumption-v1' }, { $set: { activatedAt: new Date('2026-10-24T08:00:00+05:30') } });
  await settleDueMeals({ userId: lifetimeUser._id, now: new Date('2026-10-25T20:00:00+05:30') });
  assert.equal((await Subscription.findById(lifetimeId)).remainingCredits, 2);
  assert.equal(await MealRecord.countDocuments({ subscription: lifetimeId, date: '2026-10-25' }), 0);
  for (const day of ['26', '27']) await Promise.all([1, 2].map(() => settleDueMeals({ userId: lifetimeUser._id, now: new Date(`2026-10-${day}T19:00:00+05:30`) })));
  const complete = await Subscription.findById(lifetimeId);
  assert.equal(complete.remainingCredits, 0);
  assert.equal(deriveSubStatus(complete, '2026-10-28'), 'Completed');
  assert.equal(await Ledger.countDocuments({ subscription: lifetimeId, operation: 'consumption' }), 2);
  await settleDueMeals({ userId: lifetimeUser._id, now: new Date('2026-11-30T20:00:00+05:30') });
  assert.equal(await MealRecord.countDocuments({ subscription: lifetimeId, status: 'Scheduled' }), 0);
  assert.equal((await Subscription.findById(lifetimeId)).consumedMeals, 2);
  // Top up a completed plan. Replaying the same request must not add credits twice.
  setTestNow('2026-10-28T08:00:00+05:30');
  const topup = { opId: randomUUID() };
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request(`/admin/subscriptions/${lifetimeId}/renew`, topup);
    assert.equal(response.status, 200, JSON.stringify(response));
    assert.equal(response.data.subscription.balances.dinner.remaining, 30);
    assert.equal(response.data.subscription.status, 'Active');
    assert.equal(response.data.subscription.endDate, null);
  }
  const topupRows = await MealRecord.find({ subscription: lifetimeId, status: 'Scheduled' }).sort({ date: 1 });
  assert.equal(topupRows.length, 30);
  assert.ok(topupRows.at(-1).date > '2026-11-27'); // 30 service days extend past a calendar month
  console.log('Credit lifetime passed: legacy end date ignored, cancellation replacement, Sunday skipped, concurrent exact exhaustion, no overspend, idempotent top-up, service beyond a calendar month.');
  console.log('Credit API/database tests passed: allocations, ownership, retries, concurrency, no overspend, renewal carry-forward, ledger reconciliation, uniqueness, legacy protection, authoritative dashboard.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await repl.stop();
}
