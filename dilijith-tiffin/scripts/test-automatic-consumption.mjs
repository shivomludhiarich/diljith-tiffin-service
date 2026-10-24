import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { randomUUID } from 'node:crypto';
import { settleDueMeals } from '../server/services/automaticConsumption.js';
import User from '../server/models/User.js';
import Subscription from '../server/models/Subscription.js';
import MealRecord from '../server/models/MealRecord.js';
import Ledger from '../server/models/CreditLedger.js';
import Activity from '../server/models/Activity.js';
import { cutoffFor } from '../src/utils/userLogic.js';
process.env.JWT_SECRET = randomUUID();
process.env.NODE_ENV = 'test';
const db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
let server;
try {
  await mongoose.connect(db.getUri(), { dbName: 'dts_test_automatic' });
  await Promise.all([MealRecord, Ledger, User, Subscription, Activity].map(m => m.init()));
  await settleDueMeals({ now: new Date('2030-01-01T00:00:00+05:30') });
  const customer = await User.create({ name: 'Automatic test', phone: '9000000001', password: randomUUID() });
  for (const mealType of ['breakfast', 'lunch', 'dinner']) {
    const sub = await Subscription.create({ user: customer._id, accountingVersion: 2, mealTypes: [mealType],
      durationMonths: 1, startDate: '2029-12-01', endDate: '2030-02-01', allocatedMeals: 5,
      mealCredits: { [mealType]: { allocated: 5, consumed: 0, adjustments: 0 } } });
    const make = (date, status = 'Scheduled') => MealRecord.create({ user: customer._id, subscription: sub._id,
      accountingVersion: 2, date, mealType, status });
    const historical = await make('2029-12-31');
    const due = await make('2030-01-02');
    const cancelled = await make('2030-01-03', 'Cancelled');
    const future = await make('2030-01-04');
    const cutoff = cutoffFor(due.date, mealType);
    await settleDueMeals({ now: new Date(cutoff.getTime() - 1) });
    assert.equal((await MealRecord.findById(due._id)).status, 'Scheduled');
    await Promise.all(Array.from({ length: 4 }, () => settleDueMeals({ now: cutoff })));
    assert.equal((await MealRecord.findById(due._id)).status, 'Consumed');
    assert.equal((await MealRecord.findById(due._id)).consumedAt.toISOString(), cutoff.toISOString());
    assert.equal((await Subscription.findById(sub._id)).mealCredits[mealType].consumed, 1);
    assert.equal(await Ledger.countDocuments({ booking: due._id }), 1);
    assert.equal(await Activity.countDocuments({ subscriptionId: String(sub._id) }), 1);
    await settleDueMeals({ now: cutoffFor(cancelled.date, mealType) });
    assert.equal((await MealRecord.findById(cancelled._id)).status, 'Cancelled');
    assert.equal((await MealRecord.findById(future._id)).status, 'Scheduled');
    assert.equal((await MealRecord.findById(historical._id)).status, 'Scheduled');
    assert.equal(await Ledger.countDocuments({ booking: cancelled._id }), 0);
  }
  // Catch up after downtime, without an administrator confirming individual meals.
  await settleDueMeals({ now: new Date('2030-01-05T00:00:00+05:30') });
  for (const sub of await Subscription.find()) assert.equal(sub.consumedMeals, 2);
  // An invalid/empty meal balance must not become negative or partially transition.
  const exhausted = await Subscription.findOne({ mealTypes: 'lunch' });
  exhausted.mealCredits.lunch.allocated = 2; await exhausted.save();
  const blocked = await MealRecord.create({ user: customer._id, subscription: exhausted._id, accountingVersion: 2,
    date: '2030-01-05', mealType: 'lunch' });
  const review = await settleDueMeals({ now: cutoffFor(blocked.date, 'lunch') });
  assert.ok(review.review > 0);
  assert.equal((await MealRecord.findById(blocked._id)).status, 'Scheduled');
  assert.equal(await Ledger.countDocuments({ booking: blocked._id }), 0);
  assert.equal((await Subscription.findById(exhausted._id)).consumedMeals, 2);
  const { default: app } = await import('../server/app.js');
  server = app.listen(0); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://localhost:${server.address().port}/api/cron/consume-meals`;
  delete process.env.CRON_SECRET;
  assert.equal((await fetch(url)).status, 503);
  process.env.CRON_SECRET = randomUUID();
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })).status, 200);
  console.log('Automatic consumption passed: all IST cutoffs, before/exact boundaries, concurrency, replay, cancellations, historical protection, catch-up, no overspend, audit and cron authorization.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); await db.stop();
}
