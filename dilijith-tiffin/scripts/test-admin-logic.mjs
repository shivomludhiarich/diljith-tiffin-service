// Run with: npm run test:admin   (plain Node, no dependencies)
import assert from 'node:assert/strict';
import { addMonths, endDateFor } from '../src/utils/dates.js';
import {
  allocateSubscription, adjustCredits, cancelSubscription, renewSubscription, creditMap, currentSubscription,
  dashboardMetrics, isValidAdminState, subscriptionStatus, validateAdjustment, recentActivity, MEAL_STATUS,
} from '../src/utils/adminLogic.js';
import { createSeed } from '../src/data/adminSeed.js';

const TODAY = '2026-10-15';
const NOW = new Date(2026, 9, 15, 10, 0, 0);
const ctx = { today: TODAY, nowIso: NOW.toISOString(), daysForMonths: (m) => m * 30 };
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const fresh = () => createSeed(TODAY, NOW);
const sub = (s, id) => s.subscriptions.find((x) => x.id === id);

test('end dates: inclusive, month-end safe', () => {
  assert.equal(endDateFor('2026-10-15', 1), '2026-11-14');
  assert.equal(endDateFor('2026-10-15', 3), '2027-01-14');
  assert.equal(endDateFor('2026-10-15', 6), '2027-04-14');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(endDateFor('2028-01-30', 1), '2028-02-28'); // leap year
});

test('seed is valid and survives a JSON round trip', () => {
  const s = fresh();
  assert.ok(isValidAdminState(s));
  assert.ok(isValidAdminState(JSON.parse(JSON.stringify(s))));
  assert.equal(isValidAdminState({ users: [] }), false);
  assert.equal(isValidAdminState(null), false);
});

test('dashboard metrics are derived from records', () => {
  const m = dashboardMetrics(fresh(), TODAY);
  assert.deepEqual(m.prep, { breakfast: 1, lunch: 4, dinner: 2 });
  assert.equal(m.mealsToday, 7);
  assert.equal(m.mealsCancelledToday, 2);
  assert.equal(m.totalUsers, 8);
  assert.equal(m.activeSubscriptions, 5);
  assert.equal(m.expiringSoon, 2);
});

test('statuses: expired and cancelled are never active', () => {
  const s = fresh();
  assert.equal(subscriptionStatus(sub(s, 'SUB-1002'), TODAY), 'Active');
  assert.equal(subscriptionStatus(sub(s, 'SUB-1003'), TODAY), 'Expiring soon');
  assert.equal(subscriptionStatus(sub(s, 'SUB-1004'), TODAY), 'Expired');
  assert.equal(subscriptionStatus(sub(s, 'SUB-1005'), TODAY), 'Cancelled');
});

test('balance = allocated - consumed + adjustments (60 / 22 / 38 example)', () => {
  const s = fresh();
  const c = creditMap(s)['SUB-1002'];
  assert.deepEqual([c.allocated, c.consumed, c.remaining], [60, 22, 38]);
});

test('cancelled and missed meals never reduce the balance', () => {
  const s = fresh();
  const c = creditMap(s)['SUB-1003'];
  const recs = s.mealRecords.filter((m) => m.subscriptionId === 'SUB-1003');
  const consumed = recs.filter((m) => m.status === 'Consumed').length;
  assert.ok(recs.some((m) => m.status === 'Cancelled') && recs.some((m) => m.status === 'Missed'));
  assert.equal(c.consumed, consumed);
  assert.equal(c.remaining, 90 - consumed + 10);
});

test('adjust +10: entitlement 60 -> 70, remaining 38 -> 48, history saved', () => {
  const s = fresh();
  const r = adjustCredits(s, { subscriptionId: 'SUB-1002', amount: '10', reason: 'Test top-up' }, ctx);
  assert.ok(r.ok);
  const c = creditMap(r.state)['SUB-1002'];
  assert.deepEqual([c.entitlement, c.remaining], [70, 48]);
  assert.equal(r.state.adjustments.filter((a) => a.subscriptionId === 'SUB-1002').length, 1);
  assert.equal(recentActivity(r.state, 1)[0].label, 'Meal credits increased');
  assert.equal(creditMap(s)['SUB-1002'].remaining, 38); // original state untouched
});

test('adjustment validation', () => {
  const s = fresh();
  const bad = (amount, reason) => adjustCredits(s, { subscriptionId: 'SUB-1002', amount, reason }, ctx);
  assert.ok(bad('0', 'x reason').errors.amount);
  assert.ok(bad('1.5', 'x reason').errors.amount);
  assert.ok(bad('abc', 'x reason').errors.amount);
  assert.ok(bad('', 'x reason').errors.amount);
  assert.ok(bad('5', '').errors.reason);
  assert.ok(bad('-39', 'correction').errors.amount); // below zero
  assert.ok(bad('-38', 'correction').ok);
  assert.ok(adjustCredits(s, { subscriptionId: 'SUB-1004', amount: '5', reason: 'expired sub' }, ctx).errors.form);
  assert.ok(validateAdjustment(null, { amount: '3', reason: 'abc' }).errors.amount === undefined);
});

test('allocate 1 month lunch+dinner for a user with no plan', () => {
  const s = fresh();
  const r = allocateSubscription(s, { userId: 'u7', durationMonths: 1, mealTypes: ['dinner', 'lunch'], startDate: TODAY, allocatedMeals: 60 }, ctx);
  assert.ok(r.ok);
  assert.equal(r.subscription.id, 'SUB-1008');
  assert.equal(r.subscription.endDate, '2026-11-14');
  assert.deepEqual(r.subscription.mealTypes, ['lunch', 'dinner']);
  assert.equal(r.state.subscriptions.length, s.subscriptions.length + 1);
  assert.equal(currentSubscription(r.state, 'u7', TODAY).id, 'SUB-1008');
  const c = creditMap(r.state)['SUB-1008'];
  assert.deepEqual([c.entitlement, c.consumed, c.remaining], [60, 0, 60]);
  const m = dashboardMetrics(r.state, TODAY);
  assert.equal(m.activeSubscriptions, 6);
  assert.deepEqual(m.prep, { breakfast: 1, lunch: 5, dinner: 3 });
  assert.equal(recentActivity(r.state, 1)[0].label, 'Subscription allocated');
  // then +10 credits on the same user's plan
  const a = adjustCredits(r.state, { subscriptionId: 'SUB-1008', amount: '10', reason: 'Bonus' }, ctx);
  const c2 = creditMap(a.state)['SUB-1008'];
  assert.deepEqual([c2.entitlement, c2.remaining], [70, 70]);
});

test('allocation validation', () => {
  const s = fresh();
  const r = allocateSubscription(s, { userId: '', durationMonths: 2, mealTypes: [], startDate: '2026-13-40', allocatedMeals: 0 }, ctx);
  assert.deepEqual(Object.keys(r.errors).sort(), ['allocatedMeals', 'durationMonths', 'mealTypes', 'startDate', 'userId']);
});

test('replacing a live plan needs confirmation and keeps history', () => {
  const s = fresh();
  const input = { userId: 'u2', durationMonths: 3, mealTypes: ['lunch'], startDate: TODAY, allocatedMeals: 90 };
  const blocked = allocateSubscription(s, input, ctx);
  assert.equal(blocked.needsConfirm, true);
  assert.equal(blocked.existing.id, 'SUB-1002');
  assert.equal(blocked.state, undefined);
  const r = allocateSubscription(s, { ...input, confirmReplace: true }, ctx);
  assert.ok(r.ok);
  const old = sub(r.state, 'SUB-1002');
  assert.equal(old.status, 'Cancelled');
  assert.equal(old.replacedBy, r.subscription.id);
  const oldRecs = (st) => st.mealRecords.filter((m) => m.subscriptionId === 'SUB-1002');
  assert.equal(oldRecs(r.state).length, oldRecs(s).length); // nothing deleted
  assert.equal(oldRecs(r.state).filter((m) => m.status === 'Scheduled' && m.date >= TODAY).length, 0);
  assert.equal(creditMap(r.state)['SUB-1002'].consumed, 22); // history intact
});

test('renew an expired plan: new end date, Active again, credits added', () => {
  const s = fresh();
  const r = renewSubscription(s, 'SUB-1004', ctx);
  assert.ok(r.ok);
  const n = sub(r.state, 'SUB-1004');
  assert.equal(n.endDate, '2027-01-14');
  assert.equal(subscriptionStatus(n, TODAY), 'Active');
  assert.equal(n.renewals.length, 1);
  assert.equal(creditMap(r.state)['SUB-1004'].entitlement, 90 + 90);
  assert.equal(r.state.subscriptions.length, s.subscriptions.length);
  assert.equal(renewSubscription(r.state, 'SUB-1004', ctx).ok, false); // no double renewal
});

test('renew an expiring plan continues from the day after its end date', () => {
  const s = fresh();
  const r = renewSubscription(s, 'SUB-1007', ctx);
  assert.ok(r.ok);
  assert.equal(r.subscription.endDate, '2026-11-17');
  assert.equal(r.state.subscriptions.length, s.subscriptions.length);
  assert.equal(renewSubscription(s, 'SUB-1002', ctx).ok, false); // healthy plans are not renewable
  assert.equal(renewSubscription(s, 'SUB-1005', ctx).ok, false); // cancelled plans are not renewable
});

test('cancel keeps the record, meal history and consumed count', () => {
  const s = fresh();
  const r = cancelSubscription(s, 'SUB-1001', ctx);
  assert.ok(r.ok);
  assert.equal(sub(r.state, 'SUB-1001').status, 'Cancelled');
  assert.equal(r.state.subscriptions.length, s.subscriptions.length);
  assert.equal(r.state.mealRecords.length, s.mealRecords.length);
  assert.equal(creditMap(r.state)['SUB-1001'].consumed, creditMap(s)['SUB-1001'].consumed);
  assert.equal(r.state.mealRecords.filter((m) => m.subscriptionId === 'SUB-1001' && m.status === 'Scheduled' && m.date >= TODAY).length, 0);
  assert.equal(dashboardMetrics(r.state, TODAY).activeSubscriptions, 4);
  assert.equal(cancelSubscription(r.state, 'SUB-1001', ctx).ok, false);
  assert.equal(cancelSubscription(s, 'SUB-1004', ctx).ok, false); // expired, nothing to cancel
});

test('no scheduled meal is ever double counted as consumed', () => {
  const s = fresh();
  const ids = new Set(s.mealRecords.map((m) => m.id));
  assert.equal(ids.size, s.mealRecords.length); // unique ids
  const perSlot = new Set(s.mealRecords.map((m) => `${m.subscriptionId}|${m.date}|${m.mealType}`));
  assert.equal(perSlot.size, s.mealRecords.length); // one record per sub/day/meal
  assert.ok(Object.values(creditMap(s)).every((c) => c.remaining >= 0));
});

console.log(`\n${passed} tests passed`);
