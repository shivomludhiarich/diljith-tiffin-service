// Customer dashboard logic. Pure functions over the SAME shared records the admin portal uses
// (subscriptions, mealRecords, adjustments, activity), so both portals always agree.
//
// Written so it can move to an Express service unchanged: every function takes the authenticated user's id
// as an argument and never reads anything the browser could forge. In this frontend-only build that id comes
// from the demo session; with a real backend it must come from the validated token.
import { parseDate, addDays, formatDate } from './dates.js';
import { MEAL_KEYS } from './pricing.js';
import {
  MEAL_STATUS, NO_SUB, SUB_STATUS, creditMap, durationLabel, isLive, mealLabel, mealsLabel, subscriptionStatus, uid, perMealCredits,
} from './adminLogic.js';
import { MEAL_POLICY } from '../config/mealPolicy.js';

export const NOT_INCLUDED = 'Not Included';
export const NOT_SCHEDULED = 'Not scheduled';

/** The moment cancellation closes for a meal on `date`. */
export function cutoffFor(date, mealType, policy = MEAL_POLICY) {
  const rule = policy.cancellation[mealType];
  return new Date(`${addDays(date, rule.dayOffset)}T${rule.time}:00+05:30`);
}

export const planDetails = (sub) =>
  `${sub.id}, ${durationLabel(sub.durationMonths)}, ${mealsLabel(sub.mealTypes)} (ends ${formatDate(sub.endDate)})`;

/** Subscriptions, stats and expiry info for one user. Expired and cancelled plans are never counted as active. */
export function userSummary(state, userId, today) {
  const credits = creditMap(state);
  const all = state.subscriptions
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id))
    .map((sub) => {
      const credit = credits[sub.id];
      return {
        sub, status: subscriptionStatus(sub, today), credit,
        percentUsed: credit.entitlement > 0 ? Math.min(100, Math.round((credit.consumed / credit.entitlement) * 100)) : 0,
      };
    });
  const running = all.filter((x) => isLive(x.status));
  const past = all.filter((x) => !isLive(x.status));
  const runningIds = new Set(running.map((x) => x.sub.id));
  const records = state.mealRecords.filter((m) => runningIds.has(m.subscriptionId));

  const expiries = running.map((x) => x.sub.endDate).sort();
  const expiring = running.filter((x) => x.status === SUB_STATUS.EXPIRING);

  let overallStatus = NO_SUB;
  if (running.length) overallStatus = expiring.length ? SUB_STATUS.EXPIRING : SUB_STATUS.ACTIVE;

  // Per-meal-type credit breakdown (independent balances, never combined)
  const mealCredits = perMealCredits(state, userId, today, credits);

  return {
    running, past, overallStatus, expiring,
    nearestExpiry: expiries[0] ?? null,
    mealCredits, // { breakfast: {allocated,consumed,remaining,...}|null, lunch: ..., dinner: ... }
    stats: {
      // remaining = allocated - consumed + net adjustments, summed over RUNNING subscriptions only
      remaining: running.reduce((n, x) => n + x.credit.remaining, 0),
      consumed: records.filter((m) => m.status === MEAL_STATUS.CONSUMED).length,
      // meals the customer cancelled (not ones cancelled because a whole plan was cancelled or replaced)
      cancelled: records.filter((m) => m.status === MEAL_STATUS.CANCELLED && m.cancelledBy !== 'subscription').length,
      activeSubscriptions: running.length,
      // Per-meal breakdown for the dashboard — these are the authoritative balances.
      // A user with 0 dinnerRemaining but 20 lunchRemaining must NOT consume dinner.
      breakdownByMeal: mealCredits,
    },
  };
}

/** Breakfast / lunch / dinner for today: included?, status, deadline, and whether cancelling is still allowed. */
export function todaysMeals(state, userId, today, now = new Date(), policy = MEAL_POLICY) {
  const live = state.subscriptions.filter(
    (s) => s.userId === userId && isLive(subscriptionStatus(s, today)) && s.startDate <= today);
  const liveIds = new Set(live.map((s) => s.id));

  return MEAL_KEYS.map((mealType) => {
    const included = live.some((s) => s.mealTypes.includes(mealType));
    const cutoff = cutoffFor(today, mealType, policy);
    const entries = state.mealRecords
      .filter((m) => m.userId === userId && m.date === today && m.mealType === mealType && liveIds.has(m.subscriptionId))
      .map((m) => ({
        id: m.id, subscriptionId: m.subscriptionId, status: m.status, cancelledAt: m.cancelledAt ?? null,
        cancellable: m.status === MEAL_STATUS.SCHEDULED && now < cutoff,
      }));
    return { mealType, included, cutoff, entries, status: entries.length ? null : included ? NOT_SCHEDULED : NOT_INCLUDED };
  });
}

const ORDER = { breakfast: 0, lunch: 1, dinner: 2 };
export function recentMealActivity(state, userId, today, limit = 8) {
  return state.mealRecords
    .filter((m) => m.userId === userId && m.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || ORDER[b.mealType] - ORDER[a.mealType])
    .slice(0, limit);
}

const fail = (message) => ({ ok: false, errors: { form: message } });

/**
 * Customer cancels one meal. All checks live here (the "server" side):
 * ownership, status, active subscription, and the cancellation deadline.
 * A timely cancellation keeps the credit: the record becomes Cancelled, never Consumed.
 */
export function cancelMeal(state, { userId, recordId }, { today, nowIso }, policy = MEAL_POLICY) {
  const rec = state.mealRecords.find((m) => m.id === recordId);
  if (!rec || rec.userId !== userId) return fail('Meal not found.'); // same answer for someone else's record
  if (rec.status === MEAL_STATUS.CANCELLED) return fail('This meal is already cancelled.');
  if (rec.status !== MEAL_STATUS.SCHEDULED) return fail(`A ${rec.status.toLowerCase()} meal cannot be cancelled.`);

  const sub = state.subscriptions.find((s) => s.id === rec.subscriptionId);
  if (!sub || !isLive(subscriptionStatus(sub, today))) return fail('This meal belongs to a subscription that is no longer active.');

  const cutoff = cutoffFor(rec.date, rec.mealType, policy);
  if (new Date(nowIso) >= cutoff) {
    return fail(`The cancellation deadline for this meal passed on ${cutoff.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}.`);
  }

  const user = state.users.find((u) => u.id === userId);
  const next = {
    ...state,
    mealRecords: state.mealRecords.map((m) => (m.id === rec.id ? { ...m, status: MEAL_STATUS.CANCELLED, cancelledAt: nowIso, cancelledBy: 'user' } : m)),
    activity: [{
      id: uid('act'), createdAt: nowIso, type: 'meal_cancelled', label: 'Meal cancelled', userId, userName: user?.name ?? 'Customer',
      subscriptionId: sub.id, detail: `${mealLabel(rec.mealType)} on ${formatDate(rec.date)} (${sub.id}), cancelled by the customer`,
    }, ...state.activity].slice(0, 200),
  };
  return { ok: true, state: next, record: { ...rec, status: MEAL_STATUS.CANCELLED } };
}
