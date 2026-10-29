import { ensureMealSchedule } from './mealSchedule.js';
import { isServiceDay } from '../../src/utils/serviceDays.js';
import mongoose from 'mongoose';
import MealRecord from '../models/MealRecord.js';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import CreditLedger from '../models/CreditLedger.js';
import Activity from '../models/Activity.js';
import { balances, syncTotals } from './credits.js';
import { cutoffFor } from '../../src/utils/userLogic.js';
import { todayStr, addDays } from '../../src/utils/dates.js';

// Activation is persisted once, not reset on cold starts or redeployments.
const Policy = mongoose.models.MealAccountingPolicy || mongoose.model('MealAccountingPolicy', new mongoose.Schema({
  _id: String, activatedAt: { type: Date, required: true },
}));
export async function settleDueMeals({ now = new Date(), userId } = {}) {
  await Promise.all([Policy.init(), CreditLedger.init(), Activity.init()]);
  let policy;
  try {
    policy = await Policy.findOneAndUpdate({ _id: 'automatic-consumption-v1' },
      { $setOnInsert: { activatedAt: now } }, { upsert: true, returnDocument: 'after' });
  } catch (error) {
    if (error.code !== 11000) throw error;
    policy = await Policy.findById('automatic-consumption-v1');
  }
  if (now < policy.activatedAt) return { consumed: 0, review: 0, more: false };
  const started = Date.now();
  // Extend existing subscriptions past historical end dates without a database
  // migration. All scheduling writes share the same lock as credit mutations.
  for await (const candidate of Subscription.find({ status: { $ne: 'Cancelled' }, accountingVersion: 2, ...(userId ? { user: userId } : {}) }).cursor()) {
    if (Date.now() - started > 15000) return { consumed: 0, review: 0, more: true };
    if (!await ensureMealSchedule(candidate, undefined, { now, activatedAt: policy.activatedAt, dryRun: true })) continue;
    await mongoose.connection.transaction(async session => {
      const customer = await User.findOneAndUpdate({ _id: candidate.user }, { $inc: { creditRevision: 1 } }, { session });
      if (!customer) return;
      const sub = await Subscription.findById(candidate._id).session(session);
      if (sub) await ensureMealSchedule(sub, session, { now, activatedAt: policy.activatedAt });
    });
  }
  const filter = { status: 'Scheduled', accountingVersion: 2,
    date: { $gte: todayStr(policy.activatedAt), $lte: addDays(todayStr(now), 1) },
    ...(userId ? { user: userId } : {}),
  };
  let consumed = 0, review = 0;
  for await (const candidate of MealRecord.find(filter).sort({ date: 1, _id: 1 }).cursor()) {
    if (!isServiceDay(candidate.date)) continue;
    const cutoff = cutoffFor(candidate.date, candidate.mealType);
    if ((cutoff < policy.activatedAt && candidate.createdAt < policy.activatedAt) || cutoff > now) continue;
    if (Date.now() - started > 15000) return { consumed, review, more: true };
    const outcome = await mongoose.connection.transaction(async session => {
      // Same customer lock used by cancellation, allocation and credit adjustments.
      const customer = await User.findOneAndUpdate({ _id: candidate.user }, { $inc: { creditRevision: 1 } }, { session, returnDocument: 'after' });
      const record = await MealRecord.findById(candidate._id).session(session);
      if (!record || record.status !== 'Scheduled') return 'unchanged';
      const warn = async reason => {
        record.accountingWarning = { reason, checkedAt: now };
        await record.save({ session }); return 'review';
      };
      if (!customer) return warn('Customer account is missing.');
      const sub = await Subscription.findById(record.subscription).session(session);
      const credit = sub && balances(sub)?.[record.mealType];
      if (!sub) return warn('Subscription is missing.');
      if (sub.status === 'Cancelled') return warn('Subscription is cancelled.');
      if (String(sub.user) !== String(record.user)) return warn('Meal and subscription belong to different customers.');
      if (record.date < sub.startDate) return warn('Meal date is outside the subscription period.');
      if (!credit) return warn('Meal credit allocation requires review.');
      if (credit.remaining < 1) return warn('No credits remain for this meal type.');
      sub.mealCredits[record.mealType].consumed++;
      syncTotals(sub);
      record.accountingWarning = undefined;
      record.status = 'Consumed'; record.consumedAt = cutoff;
      await sub.save({ session }); await record.save({ session });
      await CreditLedger.create([{ user: record.user, subscription: sub._id, booking: record._id,
        mealType: record.mealType, delta: -1, operation: 'consumption',
        operationKey: `automatic:${record._id}`, reason: 'Cancellation deadline passed' }], { session });
      await Activity.create([{ type: 'meal_consumed', label: 'Meal automatically consumed',
        userId: String(record.user), subscriptionId: String(sub._id),
        detail: `${record.mealType} on ${record.date}: cancellation deadline passed` }], { session });
      return 'consumed';
    });
    if (outcome === 'consumed') consumed++;
    if (outcome === 'review') review++;
  }
  return { consumed, review, more: false };
}

export async function reconcileMeals(req, res, next) {
  try {
    const result = await settleDueMeals({ userId: req.user.role === 'admin' ? undefined : req.user._id });
    req.mealAccounting = result;
    if (result.more && !(req.user.role === 'admin' && req.method === 'GET' && req.path === '/state')) return res.status(503).json({ ok: false, message: 'Meal accounting is catching up. Please retry shortly.' });
    next();
  } catch {
    console.error('[Meal accounting] Automatic consumption failed.');
    res.status(503).json({ ok: false, message: 'Meal accounting is temporarily unavailable. Please retry.' });
  }
}
