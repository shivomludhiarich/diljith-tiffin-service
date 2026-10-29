import { isServiceDay } from './serviceDays.js';
// Display helpers and legacy demo-fixture commands. Authenticated operations use
// the backend credit service; demo commands are never used as API fallbacks.
// Backend `credit` and `balances` fields are authoritative for API records.
import { addDays, diffDays, endDateFor, isValidDateStr } from './dates.js';
import { MEAL_KEYS } from './pricing.js';

export const EXPIRING_DAYS = 7;
export const DURATIONS = [1, 3, 6, 12]; // Must match server/controllers/adminController.js DURATIONS
export const SUB_STATUS = { ACTIVE: 'Active', EXPIRING: 'Expiring soon', EXPIRED: 'Completed', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
export const MEAL_STATUS = { SCHEDULED: 'Scheduled', CANCELLED: 'Cancelled', CONSUMED: 'Consumed', MISSED: 'Missed' };
export const NO_SUB = 'No subscription';

let seq = 0;
export const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const mealLabel = (k) => k.charAt(0).toUpperCase() + k.slice(1);
export const durationLabel = (m) => `${m} month${m === 1 ? '' : 's'}`;
export const mealsLabel = (types) => MEAL_KEYS.filter((k) => types.includes(k)).map(mealLabel).join(', ');

// ---------- status ----------
export function subscriptionStatus(sub, today) {
  if (sub.status === 'Cancelled') return SUB_STATUS.CANCELLED;
  const remaining = sub.credit?.remaining ?? sub.remainingCredits ??
    (sub.accountingVersion === 2 && sub.mealCredits ? sub.mealTypes.reduce((n, t) => {
      const c = sub.mealCredits[t]; return n + (c ? c.allocated + c.adjustments - c.consumed : NaN);
    }, 0) : sub.allocatedMeals + (sub.approvedAdjustments || 0) - (sub.consumedMeals || 0));
  if (remaining === 0) return SUB_STATUS.COMPLETED;
  return SUB_STATUS.ACTIVE;
}
export const isLive = (status) => status === SUB_STATUS.ACTIVE || status === SUB_STATUS.EXPIRING;
export const isRenewable = sub => sub.status !== 'Cancelled';
export const isCancellable = (sub, today) => isLive(subscriptionStatus(sub, today));

// ---------- credits ----------
/** { [subscriptionId]: { allocated, adjustments, entitlement, consumed, remaining } } in a single pass. */
export function creditMap(state) {
  const map = {};
  for (const s of state.subscriptions) map[s.id] = { allocated: s.allocatedMeals, adjustments: 0, consumed: 0 };
  for (const a of state.adjustments) if (map[a.subscriptionId]) map[a.subscriptionId].adjustments += a.amount;
  for (const m of state.mealRecords) if (m.status === MEAL_STATUS.CONSUMED && map[m.subscriptionId]) map[m.subscriptionId].consumed += 1;
  for (const c of Object.values(map)) {
    c.entitlement = c.allocated + c.adjustments;
    c.remaining = c.allocated - c.consumed + c.adjustments;
  }
  for (const s of state.subscriptions) {
    if ('credit' in s) map[s.id] = s.credit ?? { allocated: null, consumed: null, adjustments: null, entitlement: null, remaining: null };
  }
  return map;
}
export const creditSummary = (state, subId) => creditMap(state)[subId] ?? null;

/**
 * Per-meal-type credit summary for a user across all their LIVE subscriptions.
 * Returns { breakfast: {allocated,consumed,remaining,...} | null, lunch: ..., dinner: ... }
 * A meal type is null when the user has no live subscription covering it.
 */
export function perMealCredits(state, userId, today, credits) {
  const live = state.subscriptions.filter(
    (s) => s.userId === userId && isLive(subscriptionStatus(s, today))
  );
  const result = { breakfast: null, lunch: null, dinner: null };
  for (const mealType of MEAL_KEYS) {
    // Collect all live subs that include this meal type
    const covering = live.filter((s) => s.mealTypes.includes(mealType));
    if (!covering.length) continue;
    if (covering.some(s => s.requiresCreditReview || (!('balances' in s) && s.mealTypes.length > 1))) {
      result[mealType] = { allocated: null, consumed: null, adjustments: null, entitlement: null, remaining: null, requiresReview: true };
      continue;
    }
    // Sum credits across all covering subscriptions
    let allocated = 0, consumed = 0, adjustments = 0;
    for (const s of covering) {
      const c = 'balances' in s ? s.balances?.[mealType] : (s.mealTypes.length === 1 ? credits[s.id] : null);
      if (!c) continue;
      allocated += c.allocated;
      consumed += c.consumed;
      adjustments += c.adjustments;
    }
    result[mealType] = {
      allocated,
      consumed,
      adjustments,
      entitlement: allocated + adjustments,
      remaining: allocated - consumed + adjustments,
      subscriptions: covering.map((s) => s.id),
    };
  }
  return result;
}

export const defaultEntitlement = (months, mealTypes, daysForMonths = (m) => m * 30) => daysForMonths(months) * mealTypes.length;

/** A user's "current" subscription: the newest live one, otherwise the newest of any status. */
export function currentSubscription(state, userId, today) {
  const subs = state.subscriptions
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return subs.find((s) => isLive(subscriptionStatus(s, today))) ?? subs[0] ?? null;
}

// ---------- read models ----------
export function todaysPrep(state, today) {
  const subById = Object.fromEntries(state.subscriptions.map((s) => [s.id, s]));
  const prep = { breakfast: 0, lunch: 0, dinner: 0 };
  for (const m of state.mealRecords) {
    if (m.date !== today || m.status !== MEAL_STATUS.SCHEDULED) continue;
    if (subById[m.subscriptionId]?.status === 'Cancelled') continue;
    if (m.mealType in prep) prep[m.mealType] += 1;
  }
  return prep;
}

export function dashboardMetrics(state, today) {
  const credits = creditMap(state);
  const statuses = state.subscriptions.map((s) => subscriptionStatus({ ...s, credit: credits[s.id] }, today));
  const prep = todaysPrep(state, today);
  return {
    totalUsers: state.users.filter((u) => u.role !== 'admin').length,
    activeSubscriptions: statuses.filter(isLive).length,
    expiringSoon: statuses.filter((s) => s === SUB_STATUS.EXPIRING).length,
    mealsToday: prep.breakfast + prep.lunch + prep.dinner,
    mealsCancelledToday: state.mealRecords.filter((m) => m.date === today && m.status === MEAL_STATUS.CANCELLED).length,
    prep,
  };
}

export function userRows(state, today, credits) {
  return state.users
    .filter((u) => u.role !== 'admin')
    .map((user) => {
      const sub = currentSubscription(state, user.id, today);
      return { user, sub, status: sub ? subscriptionStatus(sub, today) : NO_SUB, credits: sub ? credits[sub.id] : null };
    });
}

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };
export function recentMeals(state, filter, limit = 10) {
  return state.mealRecords
    .filter((m) => (filter.userId ? m.userId === filter.userId : true) && (filter.subscriptionId ? m.subscriptionId === filter.subscriptionId : true))
    .sort((a, b) => b.date.localeCompare(a.date) || MEAL_ORDER[b.mealType] - MEAL_ORDER[a.mealType])
    .slice(0, limit);
}

export const recentActivity = (state, limit = 8) =>
  [...state.activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);

// ---------- meal scheduling ----------
export function scheduleMeals(sub, fromDate, cap) {
  const out = [];
  const types = MEAL_KEYS.filter((m) => sub.mealTypes.includes(m));
  const start = fromDate > sub.startDate ? fromDate : sub.startDate;
  for (let d = start; out.length < cap; d = addDays(d, 1)) {
    if (!isServiceDay(d)) continue;
    for (const mealType of types) {
      if (out.length >= cap) break;
      out.push({ id: uid('meal'), userId: sub.userId, subscriptionId: sub.id, date: d, mealType, status: MEAL_STATUS.SCHEDULED });
    }
  }
  return out;
}

const cancelFutureMeals = (records, subId, today, nowIso) =>
  records.map((r) => (r.subscriptionId === subId && r.status === MEAL_STATUS.SCHEDULED && r.date >= today
    ? { ...r, status: MEAL_STATUS.CANCELLED, cancelledAt: nowIso, cancelledBy: 'subscription' } : r));

const nextSubId = (state) =>
  `SUB-${Math.max(1000, ...state.subscriptions.map((s) => Number((/^SUB-(\d+)$/.exec(s.id) || [])[1]) || 0)) + 1}`;

const addActivity = (state, entry, nowIso) => ({
  ...state,
  activity: [{ id: uid('act'), createdAt: nowIso, ...entry }, ...state.activity].slice(0, 200),
});

const fail = (errors) => ({ ok: false, errors });

// ---------- commands ----------

/**
 * Find live subscriptions for the given user that cover at least one of the requested meal types.
 * Returns an array of { sub, overlappingMeals } objects.
 */
function findMealTypeConflicts(state, userId, mealTypes, today) {
  const conflicts = [];
  const live = state.subscriptions.filter(
    (s) => s.userId === userId && isLive(subscriptionStatus(s, today))
  );
  for (const s of live) {
    const overlap = mealTypes.filter((m) => s.mealTypes.includes(m));
    if (overlap.length) conflicts.push({ sub: s, overlappingMeals: overlap });
  }
  return conflicts;
}

export function allocateSubscription(state, input, { today, nowIso }) {
  const errors = {};
  const user = state.users.find((u) => u.id === input.userId);
  const months = Number(input.durationMonths);
  const meals = MEAL_KEYS.filter((m) => (input.mealTypes || []).includes(m));
  const allocated = Number(input.allocatedMeals);
  if (!user) errors.userId = 'Select a user.';
  if (!DURATIONS.includes(months)) errors.durationMonths = 'Choose a duration.';
  if (!meals.length) errors.mealTypes = 'Select at least one meal type.';
  if (!isValidDateStr(input.startDate)) errors.startDate = 'Choose a valid start date.';
  if (!Number.isInteger(allocated) || allocated < 1 || allocated > 5000) errors.allocatedMeals = 'Enter a whole number of meals from 1 to 5000.';
  if (Object.keys(errors).length) return fail(errors);

  // Check for per-meal-type conflicts only — a user may have active subscriptions
  // for different meal types, which is fully supported and should not block allocation.
  const conflicts = findMealTypeConflicts(state, user.id, meals, today);
  if (conflicts.length && !input.confirmReplace) {
    // Return targeted conflict info: which meal types clash and with which subscription(s).
    return {
      ok: false,
      needsConfirm: true,
      conflicts, // [{ sub, overlappingMeals }]
      existing: conflicts[0].sub, // kept for backward compat
      errors: {},
    };
  }

  const sub = {
    id: nextSubId(state),
    userId: user.id,
    durationMonths: months,
    mealTypes: meals,
    startDate: input.startDate,
    endDate: null,
    allocatedMeals: allocated,
    status: 'Active',
    createdAt: nowIso,
    demoPrice: input.demoPrice ?? null,
    renewals: [],
  };

  let subscriptions = state.subscriptions;
  let mealRecords = state.mealRecords;

  // Only cancel the conflicting subscriptions (same meal type), never unrelated ones.
  const replaced = [];
  if (conflicts.length && input.confirmReplace) {
    for (const { sub: conflictSub } of conflicts) {
      subscriptions = subscriptions.map((s) =>
        s.id === conflictSub.id
          ? { ...s, status: 'Cancelled', cancelledAt: nowIso, cancelReason: `Replaced by ${sub.id}`, replacedBy: sub.id }
          : s
      );
      mealRecords = cancelFutureMeals(mealRecords, conflictSub.id, today, nowIso);
      replaced.push(conflictSub);
    }
  }

  const replacedLabel = replaced.length ? ` (replaced ${replaced.map((s) => s.id).join(', ')})` : '';
  const next = addActivity(
    { ...state, subscriptions: [...subscriptions, sub], mealRecords: [...mealRecords, ...scheduleMeals(sub, today, allocated)] },
    {
      type: 'allocated', label: 'Subscription allocated', userId: user.id, userName: user.name, subscriptionId: sub.id,
      detail: `${sub.id} · ${durationLabel(months)} · ${mealsLabel(meals)} · ${allocated} meals${replacedLabel}`,
    },
    nowIso
  );
  return { ok: true, state: next, subscription: sub, user, replaced: replaced[0] ?? null, replacedAll: replaced };
}

export function previewRenewal(sub, today, daysForMonths) {
  const base = sub.startDate > today ? sub.startDate : today;
  return {
    periodStart: base,
    newEndDate: null,
    creditsAdded: defaultEntitlement(sub.durationMonths, sub.mealTypes, daysForMonths),
  };
}

export function renewSubscription(state, subId, { today, nowIso, daysForMonths }) {
  const sub = state.subscriptions.find((s) => s.id === subId);
  if (!sub) return fail({ form: 'Subscription not found.' });
  if (!isRenewable(sub, today)) return fail({ form: 'Cancelled subscriptions cannot be renewed.' });
  const user = state.users.find((u) => u.id === sub.userId);
  const { periodStart, newEndDate, creditsAdded } = previewRenewal(sub, today, daysForMonths);

  const renewed = {
    ...sub,
    endDate: newEndDate,
    status: 'Active',
    renewals: [...(sub.renewals || []), { id: uid('ren'), renewedAt: nowIso, previousEndDate: sub.endDate, periodStart, newEndDate, creditsAdded }],
  };
  const adjustment = {
    id: uid('adj'), userId: sub.userId, subscriptionId: sub.id, amount: creditsAdded,
    reason: `Renewal: ${durationLabel(sub.durationMonths)}`, kind: 'renewal', createdAt: nowIso,
  };
  let next = { ...state, subscriptions: state.subscriptions.map((s) => (s.id === sub.id ? renewed : s)), adjustments: [...state.adjustments, adjustment] };

  const remaining = creditMap(next)[sub.id].remaining;
  const alreadyScheduled = next.mealRecords.filter((m) => m.subscriptionId === sub.id && m.status === MEAL_STATUS.SCHEDULED && m.date >= today).length;
  next = { ...next, mealRecords: [...next.mealRecords, ...scheduleMeals(renewed, periodStart, Math.max(0, remaining - alreadyScheduled))] };
  next = addActivity(next, {
    type: 'renewed', label: 'Subscription renewed', userId: sub.userId, userName: user?.name ?? 'Unknown user', subscriptionId: sub.id,
    detail: `${sub.id} · no expiry · +${creditsAdded} meals`,
  }, nowIso);
  return { ok: true, state: next, subscription: renewed };
}

export function cancelSubscription(state, subId, { today, nowIso }) {
  const sub = state.subscriptions.find((s) => s.id === subId);
  if (!sub) return fail({ form: 'Subscription not found.' });
  if (!isCancellable(sub, today)) return fail({ form: 'Only active subscriptions can be cancelled.' });
  const user = state.users.find((u) => u.id === sub.userId);
  let next = {
    ...state,
    subscriptions: state.subscriptions.map((s) => (s.id === sub.id ? { ...s, status: 'Cancelled', cancelledAt: nowIso, cancelReason: 'Cancelled by admin' } : s)),
    mealRecords: cancelFutureMeals(state.mealRecords, sub.id, today, nowIso),
  };
  next = addActivity(next, {
    type: 'cancelled', label: 'Subscription cancelled', userId: sub.userId, userName: user?.name ?? 'Unknown user', subscriptionId: sub.id,
    detail: `${sub.id} cancelled. History kept.`,
  }, nowIso);
  return { ok: true, state: next, subscription: { ...sub, status: 'Cancelled' } };
}

/** Shared by the form's review step and by adjustCredits so both apply identical rules. */
export function validateAdjustment(credit, { amount, reason }) {
  const errors = {};
  const raw = String(amount ?? '').trim();
  const n = Number(raw);
  if (!/^[+-]?\d+$/.test(raw) || n === 0) errors.amount = 'Enter a whole number other than zero.';
  else if (Math.abs(n) > 5000) errors.amount = 'Adjustments are limited to 5000 meals at a time.';
  else if (credit && credit.remaining + n < 0) errors.amount = `That would take the balance below zero (current balance ${credit.remaining}).`;
  const why = String(reason ?? '').trim();
  if (why.length < 3) errors.reason = 'A reason is required (at least 3 characters).';
  else if (why.length > 200) errors.reason = 'Keep the reason under 200 characters.';
  return { errors, amount: n, reason: why };
}

export function adjustCredits(state, input, { today, nowIso }) {
  const sub = state.subscriptions.find((s) => s.id === input.subscriptionId);
  if (!sub) return fail({ form: 'Subscription not found.' });
  if (!isLive(subscriptionStatus(sub, today))) return fail({ form: 'Credits can only be adjusted on an active subscription.' });
  const { errors, amount, reason } = validateAdjustment(creditMap(state)[sub.id], input);
  if (Object.keys(errors).length) return fail(errors);
  const user = state.users.find((u) => u.id === sub.userId);
  const adjustment = { id: uid('adj'), userId: sub.userId, subscriptionId: sub.id, amount, reason, kind: 'adjustment', createdAt: nowIso };
  const next = addActivity({ ...state, adjustments: [...state.adjustments, adjustment] }, {
    type: 'credits', label: amount > 0 ? 'Meal credits increased' : 'Meal credits corrected', userId: sub.userId, userName: user?.name ?? 'Unknown user',
    subscriptionId: sub.id, detail: `${amount > 0 ? '+' : ''}${amount} meals on ${sub.id} · ${reason}`,
  }, nowIso);
  return { ok: true, state: next, adjustment };
}

export function isValidAdminState(s) {
  return !!s && ['users', 'subscriptions', 'mealRecords', 'adjustments', 'activity'].every((k) => Array.isArray(s[k])) &&
    s.users.every((u) => u && u.id && u.name) &&
    s.subscriptions.every((x) => x && x.id && x.userId && Array.isArray(x.mealTypes) && isValidDateStr(x.startDate) && (x.endDate == null || isValidDateStr(x.endDate)) && Number.isFinite(x.allocatedMeals)) &&
    s.mealRecords.every((m) => m && m.id && m.subscriptionId && isValidDateStr(m.date)) &&
    s.adjustments.every((a) => a && a.id && a.subscriptionId && Number.isFinite(a.amount)) &&
    s.activity.every((a) => a && a.id && a.createdAt);
}
