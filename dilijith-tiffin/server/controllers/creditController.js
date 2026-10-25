import { isServiceDay } from '../../src/utils/serviceDays.js';
import mongoose from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import MealRecord from '../models/MealRecord.js';
import CreditLedger from '../models/CreditLedger.js';
import CreditOperation from '../models/CreditOperation.js';
import CreditAdjustment from '../models/CreditAdjustment.js';
import Activity from '../models/Activity.js';
import { MEALS, allocations, fail, requireCredits, syncTotals } from '../services/credits.js';
import { formatSub } from './adminController.js';
import { addDays, todayStr, endDateFor, isValidDateStr } from '../../src/utils/dates.js';
import { cutoffFor } from '../../src/utils/userLogic.js';

const lookup = id => mongoose.isValidObjectId(id) ? { _id: id } : { subCode: id };
async function lockUser(userId, session) {
  const user = await User.findOneAndUpdate({ _id: userId }, { $inc: { creditRevision: 1 } }, { session, returnDocument: 'after' });
  if (!user) fail('Customer not found.', 404);
  return user;
}
async function getSub(req, session) {
  let sub = await Subscription.findOne(lookup(req.params.id)).session(session);
  if (!sub) fail('Subscription not found.', 404);
  await lockUser(sub.user, session);
  sub = await Subscription.findById(sub._id).session(session);
  requireCredits(sub);
  return sub;
}
async function ledger(sub, mealType, delta, operation, req, session, extra = {}) {
  await CreditLedger.create([{
    user: sub.user, subscription: sub._id, mealType, delta, operation,
    operationKey: req.creditKey, actor: req.user._id, expiresOn: sub.endDate, ...extra,
  }], { session });
}
async function schedule(sub, from, quotas, session) {
  const counts = Object.fromEntries(sub.mealTypes.map(t => [t, 0]));
  const rows = [];
  for (let date = from; date <= sub.endDate; date = addDays(date, 1)) {
    if (!isServiceDay(date)) continue;
    for (const mealType of sub.mealTypes) {
      if (counts[mealType] >= quotas[mealType]) continue;
      // Check historical records as well as versioned serving-key uniqueness.
      if (await MealRecord.exists({ user: sub.user, date, mealType, $or: [{ status: { $ne: 'Cancelled' } }, { subscription: sub._id }] }).session(session)) continue;
      rows.push({ user: sub.user, subscription: sub._id, date, mealType, status: 'Scheduled', accountingVersion: 2,
        servingKey: `${sub.user}:${date}:${mealType}` });
      counts[mealType]++;
    }
  }
  if (rows.length) await MealRecord.insertMany(rows, { session });
}
async function cancelScheduled(sub, session) {
  const pending = await MealRecord.find({ subscription: sub._id, status: 'Scheduled', date: { $gte: todayStr() } }).select('_id date').session(session);
  const ids = pending.filter(record => isServiceDay(record.date)).map(record => record._id);
  await MealRecord.updateMany({ _id: { $in: ids }, status: 'Scheduled' },
    { $set: { status: 'Cancelled', cancelledAt: new Date(), cancelledBy: 'subscription' }, $unset: { servingKey: '' } }, { session });
}
// Every write, receipt, ledger entry, and booking transition commits together.
// No fallback to partial writes on standalone MongoDB deployments.
function command(name, work) {
  return async (req, res) => {
    const opId = req.body?.opId;
    if (typeof opId !== 'string' || !opId.length || opId.length > 128) return res.status(400).json({ ok: false, message: 'A stable operation ID is required.' });
    req.creditKey = `${req.user._id}:${name}:${opId}`;
    const fingerprint = createHash('sha256').update(JSON.stringify({ id: req.params.id, body: req.body })).digest('hex');
    try {
      await Promise.all([CreditLedger.init(), CreditOperation.init(), MealRecord.init()]);
      let response;
      await mongoose.connection.transaction(async session => {
        const prior = await CreditOperation.findOne({ key: req.creditKey }).session(session);
        if (prior) {
          if (prior.fingerprint !== fingerprint) fail('Operation ID was already used with different input.', 409);
          response = prior.result;
          return;
        }
        response = await work(req, session);
        if (response.ok) await CreditOperation.create([{ key: req.creditKey, fingerprint, result: response }], { session });
      });
      res.status(name === 'allocate' && response.ok ? 201 : 200).json(response);
    } catch (error) {
      if (error.code === 11000) {
        const prior = await CreditOperation.findOne({ key: req.creditKey });
        if (prior?.fingerprint === fingerprint) return res.status(name === 'allocate' ? 201 : 200).json(prior.result);
      }
      const unsupported = /Transaction numbers|replica set|mongos/i.test(error.message);
      res.status(unsupported ? 503 : error.status || (error.code === 11000 ? 409 : 500)).json({ ok: false,
        message: unsupported ? 'Credit operations require MongoDB replica set transaction support.' : error.message });
    }
  };
}

export const allocateSubscription = command('allocate', async (req, session) => {
  const { userId, mealTypes, mealAllocations, durationMonths, startDate, confirmReplace, demoPrice } = req.body;
  if (!Array.isArray(mealTypes) || mealTypes.length !== 1) fail('Allocate one meal type at a time.');
  const mealCredits = allocations(mealTypes, mealAllocations);
  if (![1, 3, 6, 12].includes(durationMonths) || !isValidDateStr(startDate)) fail('Choose a valid duration and start date.');
  if (!mongoose.isValidObjectId(userId)) fail('Choose a customer.');
  const user = await lockUser(userId, session);
  if (user.role === 'admin') fail('Choose a customer account.');
  const endDate = endDateFor(startDate, durationMonths);
  const conflicts = await Subscription.find({ user: userId, status: { $ne: 'Cancelled' }, startDate: { $lte: endDate }, endDate: { $gte: startDate }, mealTypes: { $in: mealTypes } }).session(session);
  if (conflicts.length && confirmReplace !== true) return { ok: false, needsConfirm: true,
    conflicts: conflicts.map(sub => ({ sub: formatSub(sub, todayStr()), overlappingMeals: sub.mealTypes.filter(t => mealTypes.includes(t)) })) };
  const sub = new Subscription({ user: userId, subCode: `SUB-${randomUUID()}`, mealTypes, mealCredits, accountingVersion: 2,
    durationMonths, startDate, endDate, allocatedMeals: 0, demoPrice });
  for (const old of conflicts) {
    old.status = 'Cancelled'; old.cancelledAt = new Date(); old.cancelReason = 'Replaced with explicit confirmation'; old.replacedBy = sub.subCode;
    await old.save({ session });
    await cancelScheduled(old, session);
  }
  await sub.save({ session });
  for (const t of mealTypes) await ledger(sub, t, mealCredits[t].allocated, 'allocation', req, session);
  await schedule(sub, startDate < todayStr() ? todayStr() : startDate, mealAllocations, session);
  await Activity.create([{ type: 'allocated', label: 'Subscription allocated', userId, userName: user.name, subscriptionId: sub.subCode,
    detail: mealTypes.map(t => `${t}: ${mealAllocations[t]}`).join(', ') }], { session });
  return { ok: true, subscription: formatSub(sub, todayStr()) };
});

export const adjustCredits = command('adjust', async (req, session) => {
  const { amount, mealType, reason } = req.body;
  if (!MEALS.includes(mealType)) fail('Select a valid meal type.');
  if (!Number.isSafeInteger(amount) || !amount || Math.abs(amount) > 5000 || typeof reason !== 'string' || !reason.trim()) fail('Enter a non-zero integer adjustment and a reason.');
  const sub = await getSub(req, session);
  if (sub.status === 'Cancelled' || sub.endDate < todayStr()) fail('Subscription is not active.', 409);
  const c = requireCredits(sub)[mealType];
  if (!c) fail('Select one included meal type.');
  if (c.remaining + amount < 0) fail(`Only ${c.remaining} ${mealType} credits remain.`, 409);
  sub.mealCredits[mealType].adjustments += amount;
  await sub.save({ session });
  await ledger(sub, mealType, amount, 'admin_adjustment', req, session, { reason: reason.trim() });
  await CreditAdjustment.create([{ subscription: sub._id, user: sub.user, amount, mealType, reason: reason.trim() }], { session });
  return { ok: true, subscription: formatSub(sub, todayStr()) };
});

export const renewSubscription = command('renew', async (req, session) => {
  const sub = await getSub(req, session);
  if (sub.status === 'Cancelled') fail('Cancelled subscriptions cannot be renewed.', 409);
  if (sub.endDate > addDays(todayStr(), 7)) fail('Renewal is available within seven days of expiry or after expiry.', 409);
  const previousExpiry = sub.endDate;
  const fromDate = sub.endDate < todayStr() ? todayStr() : addDays(sub.endDate, 1);
  const endDate = endDateFor(fromDate, sub.durationMonths);
  if (await Subscription.exists({ _id: { $ne: sub._id }, user: sub.user, status: { $ne: 'Cancelled' }, mealTypes: { $in: sub.mealTypes }, startDate: { $lte: endDate }, endDate: { $gte: fromDate } }).session(session)) fail('Renewal overlaps another subscription.', 409);
  const addedPerMeal = sub.durationMonths * 30;
  sub.endDate = endDate; sub.status = 'Active';
  // Existing policy: extend the same allocation; never copy unused credits.
  for (const t of sub.mealTypes) {
    sub.mealCredits[t].allocated += addedPerMeal;
    await ledger(sub, t, addedPerMeal, 'renewal', req, session, { previousExpiry });
  }
  sub.renewals.push({ durationMonths: sub.durationMonths, addedMeals: addedPerMeal * sub.mealTypes.length, fromDate, toDate: endDate });
  await sub.save({ session });
  await schedule(sub, fromDate, Object.fromEntries(sub.mealTypes.map(t => [t, requireCredits(sub)[t].remaining])), session);
  return { ok: true, subscription: formatSub(sub, todayStr()) };
});

export const cancelSubscription = command('cancel-subscription', async (req, session) => {
  // Cancellation preserves legacy documents without inventing their allocation.
  const sub = await Subscription.findOne(lookup(req.params.id)).session(session);
  if (!sub) fail('Subscription not found.', 404);
  await lockUser(sub.user, session);
  if (sub.status === 'Cancelled') fail('Subscription is already cancelled.', 409);
  sub.status = 'Cancelled'; sub.cancelledAt = new Date(); sub.cancelReason = 'Cancelled by administrator';
  await sub.save({ session }); await cancelScheduled(sub, session);
  return { ok: true, subscription: formatSub(sub, todayStr()) };
});

async function booking(req, session) {
  const id = req.params.id;
  const record = await MealRecord.findOne(mongoose.isValidObjectId(id) ? { _id: id } : { recordCode: id }).session(session);
  if (!record || (req.user.role !== 'admin' && String(record.user) !== String(req.user._id))) fail('Meal not found.', 404);
  if (!isServiceDay(record.date)) fail('No meal service on Sundays.', 409);
  await lockUser(record.user, session);
  if (record.status !== 'Scheduled') fail('Meal is no longer scheduled.', 409);
  const sub = await Subscription.findById(record.subscription).session(session);
  if (!sub || String(sub.user) !== String(record.user) || sub.status === 'Cancelled' || sub.endDate < todayStr() || record.date < sub.startDate || record.date > sub.endDate) fail('Meal has no eligible subscription.', 409);
  return { record, sub };
}
export const consumeMeal = command('consume', async (req, session) => {
  const { record, sub } = await booking(req, session);
  if (record.date > todayStr()) fail('Future meals cannot be delivered.');
  const c = requireCredits(sub)[record.mealType];
  if (!c || c.remaining < 1) fail('No eligible credit for this meal type.', 409);
  sub.mealCredits[record.mealType].consumed++;
  syncTotals(sub);
  record.status = 'Consumed'; record.consumedAt = new Date();
  await sub.save({ session }); await record.save({ session });
  await ledger(sub, record.mealType, -1, 'consumption', req, session, { booking: record._id });
  return { ok: true, subscription: formatSub(sub, todayStr()), record: { id: String(record._id), status: record.status } };
});
export const cancelUserMeal = command('cancel-meal', async (req, session) => {
  const { record, sub } = await booking(req, session);
  if (new Date() >= cutoffFor(record.date, record.mealType)) fail('The cancellation deadline has passed.', 409);
  record.status = 'Cancelled'; record.cancelledAt = new Date(); record.cancelledBy = 'user'; record.servingKey = undefined;
  await record.save({ session });
  // Scheduled meals were never debited. A refund would mint a second credit.
  await ledger(sub, record.mealType, 0, 'cancellation_preserved', req, session, { booking: record._id });
  return { ok: true, record: { id: String(record._id), status: record.status }, message: 'Meal cancelled. Credit preserved.' };
});
