import MealRecord from '../models/MealRecord.js';
import { balances } from './credits.js';
import { isServiceDay } from '../../src/utils/serviceDays.js';
import { addDays, todayStr } from '../../src/utils/dates.js';
import { cutoffFor } from '../../src/utils/userLogic.js';

// Call under the customer's transaction lock. Bookings reserve credits but do
// not spend them. A cancellation frees its credit for the next service day.
export async function ensureMealSchedule(sub, session, { now = new Date(), activatedAt, dryRun = false } = {}) {
  if (sub.status === 'Cancelled') return;
  const credits = balances(sub);
  if (!credits) return;
  const today = todayStr(now);
  const from = sub.startDate > today ? sub.startDate : today;
  const records = await MealRecord.find({ user: sub.user }).session(session);
  const own = records.filter(r => String(r.subscription) === String(sub._id));
  const rows = [];
  for (const mealType of sub.mealTypes) {
    const credit = credits[mealType];
    if (!credit) continue;
    const pending = own.filter(r => r.mealType === mealType && r.status === 'Scheduled' && isServiceDay(r.date)
      && (!activatedAt || (r.date >= todayStr(activatedAt) && (cutoffFor(r.date, mealType) >= activatedAt || r.createdAt >= activatedAt)))).sort((a,b) => a.date.localeCompare(b.date));
    // A negative adjustment may reduce future reservations. Keep due records
    // for audit/review and remove only surplus, unconsumed future bookings.
    let excess = pending.length - credit.remaining;
    const removed = new Set();
    for (const r of [...pending].reverse()) {
      if (excess <= 0) break;
      if (cutoffFor(r.date, mealType) <= now) continue;
      if (dryRun) return true;
      await MealRecord.deleteOne({ _id: r._id, status: 'Scheduled' }).session(session);
      removed.add(String(r._id)); excess--;
    }
    let needed = Math.max(0, credit.remaining - (pending.length - removed.size));
    if (dryRun && needed > 0) return true;
    const occupied = new Set(records.filter(r => r.mealType === mealType && !removed.has(String(r._id))
      && (r.status !== 'Cancelled' || String(r.subscription) === String(sub._id))).map(r => r.date));
    for (let date = from; needed > 0; date = addDays(date, 1)) {
      if (!isServiceDay(date) || occupied.has(date) || (activatedAt && cutoffFor(date, mealType) <= now)) continue;
      rows.push({ user: sub.user, subscription: sub._id, date, mealType, status: 'Scheduled', accountingVersion: 2,
        servingKey: `${sub.user}:${date}:${mealType}` });
      needed--;
    }
  }
  if (rows.length) await MealRecord.insertMany(rows, { session });
  return rows.length > 0;
}
