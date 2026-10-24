// Run with: npm run test:user   (plain Node, no dependencies)
import assert from 'node:assert/strict';
import { createSeed } from '../src/data/adminSeed.js';
import { creditMap, dashboardMetrics, recentActivity, cancelSubscription, allocateSubscription } from '../src/utils/adminLogic.js';
import { cancelMeal, cutoffFor, recentMealActivity, todaysMeals, userSummary, planDetails } from '../src/utils/userLogic.js';
import { buildWhatsappUrl, isConfiguredNumber, renewalMessage } from '../src/utils/whatsapp.js';

const TODAY = '2026-10-15';
const at = (h, m = 0) => new Date(2026, 9, 15, h, m, 0);
const ctxAt = (d) => ({ today: TODAY, nowIso: d.toISOString(), daysForMonths: (x) => x * 30 });
const fresh = () => createSeed(TODAY, at(10));
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const meal = (list, type) => list.find((m) => m.mealType === type);

test('cancellation deadlines come from one policy', () => {
  assert.equal(cutoffFor('2026-10-16', 'breakfast').getTime(), new Date(2026, 9, 15, 21, 0).getTime()); // 9 PM the evening before
  assert.equal(cutoffFor('2026-10-15', 'lunch').getTime(), at(10).getTime());
  assert.equal(cutoffFor('2026-10-15', 'dinner').getTime(), at(19).getTime());
});

test('stats are derived from running subscriptions only (u2: 22 consumed, 38 left)', () => {
  const s = userSummary(fresh(), 'u2', TODAY);
  assert.equal(s.stats.remaining, 38);
  assert.equal(s.stats.consumed, 22);
  assert.equal(s.stats.cancelled, 0);
  assert.equal(s.stats.activeSubscriptions, 1);
  // Per-meal breakdown: u2 has lunch+dinner on SUB-1002
  assert.ok(s.stats.breakdownByMeal.lunch !== null, 'Lunch credits should be present for u2');
  assert.ok(s.stats.breakdownByMeal.dinner !== null, 'Dinner credits should be present for u2');
  assert.equal(s.stats.breakdownByMeal.breakfast, null, 'Breakfast not allocated for u2');
  assert.equal(s.overallStatus, 'Active');
  assert.equal(s.nearestExpiry, s.running[0].sub.endDate);
  assert.equal(s.running[0].percentUsed, Math.round((22 / 60) * 100));
});

test('stats match the admin portal numbers for every user', () => {
  const state = fresh();
  const credits = creditMap(state);
  for (const u of state.users) {
    const s = userSummary(state, u.id, TODAY);
    assert.equal(s.stats.remaining, s.running.reduce((n, x) => n + credits[x.sub.id].remaining, 0));
    assert.equal(s.stats.activeSubscriptions, s.running.length);
  }
  const totalActive = state.users.reduce((n, u) => n + userSummary(state, u.id, TODAY).stats.activeSubscriptions, 0);
  assert.equal(totalActive, dashboardMetrics(state, TODAY).activeSubscriptions);
});

test('expiring-soon plan is flagged; expired and cancelled plans are history, not active', () => {
  const state = fresh();
  const rohan = userSummary(state, 'u3', TODAY);
  assert.equal(rohan.overallStatus, 'Expiring soon');
  assert.equal(rohan.expiring.length, 1);
  const meera = userSummary(state, 'u4', TODAY); // only an expired plan
  assert.equal(meera.running.length, 0);
  assert.equal(meera.past.length, 1);
  assert.equal(meera.stats.remaining, 0);
  assert.equal(meera.stats.consumed, 0);
  assert.equal(meera.stats.cancelled, 0);
  assert.equal(meera.stats.activeSubscriptions, 0);
  assert.deepEqual(meera.stats.breakdownByMeal, { breakfast: null, lunch: null, dinner: null });
  assert.equal(meera.overallStatus, 'No subscription');
  const kabir = userSummary(state, 'u5', TODAY); // cancelled
  assert.equal(kabir.stats.activeSubscriptions, 0);
});

test('a user with no subscription gets safe empty data', () => {
  const state = fresh();
  const s = userSummary(state, 'u7', TODAY);
  assert.equal(s.running.length + s.past.length, 0);
  assert.equal(s.nearestExpiry, null);
  const meals = todaysMeals(state, 'u7', TODAY, at(10));
  assert.ok(meals.every((m) => m.status === 'Not Included' && !m.included));
  assert.deepEqual(recentMealActivity(state, 'u7', TODAY), []);
  assert.equal(userSummary(state, 'unknown-id', TODAY).running.length, 0);
});

test("today's meals reflect the real meal records", () => {
  const state = fresh();
  const u1 = todaysMeals(state, 'u1', TODAY, at(10)); // lunch-only plan, today's lunch was cancelled in the seed
  assert.equal(meal(u1, 'breakfast').status, 'Not Included');
  assert.equal(meal(u1, 'dinner').status, 'Not Included');
  assert.equal(meal(u1, 'lunch').entries[0].status, 'Cancelled');
  const u2 = todaysMeals(state, 'u2', TODAY, at(10)); // lunch + dinner
  assert.equal(meal(u2, 'lunch').entries[0].status, 'Scheduled');
  assert.equal(meal(u2, 'breakfast').status, 'Not Included');
  const u3 = todaysMeals(state, 'u3', TODAY, at(10));
  assert.ok(u3.every((m) => m.included && m.entries[0].status === 'Scheduled'));
});

test('cancel button availability follows the deadline', () => {
  const state = fresh();
  const at10 = todaysMeals(state, 'u2', TODAY, at(10));
  assert.equal(meal(at10, 'lunch').entries[0].cancellable, false); // 10:00 AM deadline passed
  assert.equal(meal(at10, 'dinner').entries[0].cancellable, true); // 7:00 PM deadline ahead
  const at16 = todaysMeals(state, 'u2', TODAY, at(19));
  assert.equal(meal(at16, 'dinner').entries[0].cancellable, false);
  assert.equal(meal(todaysMeals(state, 'u2', TODAY, at(8, 59)), 'lunch').entries[0].cancellable, true);
});

test('cancelling in time: record cancelled, credit preserved, admin counts update', () => {
  const state = fresh();
  const dinner = meal(todaysMeals(state, 'u2', TODAY, at(10)), 'dinner').entries[0];
  const before = dashboardMetrics(state, TODAY);
  const r = cancelMeal(state, { userId: 'u2', recordId: dinner.id }, ctxAt(at(10)));
  assert.ok(r.ok);
  const rec = r.state.mealRecords.find((m) => m.id === dinner.id);
  assert.equal(rec.status, 'Cancelled');
  assert.equal(rec.cancelledBy, 'user');
  assert.ok(rec.cancelledAt);
  // credit is kept: not consumed, balance unchanged, nothing deducted twice
  assert.deepEqual(creditMap(r.state)['SUB-1002'], creditMap(state)['SUB-1002']);
  assert.equal(userSummary(r.state, 'u2', TODAY).stats.remaining, 38);
  assert.equal(userSummary(r.state, 'u2', TODAY).stats.cancelled, 1);
  // admin portal sees it
  const after = dashboardMetrics(r.state, TODAY);
  assert.equal(after.prep.dinner, before.prep.dinner - 1);
  assert.equal(after.mealsCancelledToday, before.mealsCancelledToday + 1);
  assert.equal(recentActivity(r.state, 1)[0].label, 'Meal cancelled');
  assert.equal(r.state.mealRecords.length, state.mealRecords.length); // nothing deleted
  assert.equal(meal(todaysMeals(r.state, 'u2', TODAY, at(10)), 'dinner').entries[0].status, 'Cancelled');
});

test('server-side rules: duplicate, deadline, ownership, wrong status', () => {
  const state = fresh();
  const u2 = todaysMeals(state, 'u2', TODAY, at(10));
  const dinner = meal(u2, 'dinner').entries[0];
  const lunch = meal(u2, 'lunch').entries[0];
  const first = cancelMeal(state, { userId: 'u2', recordId: dinner.id }, ctxAt(at(10)));
  assert.match(cancelMeal(first.state, { userId: 'u2', recordId: dinner.id }, ctxAt(at(10))).errors.form, /already cancelled/);
  assert.match(cancelMeal(state, { userId: 'u2', recordId: lunch.id }, ctxAt(at(10))).errors.form, /deadline/);
  assert.match(cancelMeal(state, { userId: 'u2', recordId: dinner.id }, ctxAt(at(19, 1))).errors.form, /deadline/);
  assert.equal(cancelMeal(state, { userId: 'u2', recordId: dinner.id }, ctxAt(at(18, 59))).ok, true); // before the deadline
  assert.match(cancelMeal(state, { userId: 'u3', recordId: dinner.id }, ctxAt(at(10))).errors.form, /not found/); // someone else's meal
  assert.match(cancelMeal(state, { userId: 'u2', recordId: 'nope' }, ctxAt(at(10))).errors.form, /not found/);
  const consumed = state.mealRecords.find((m) => m.userId === 'u2' && m.status === 'Consumed');
  assert.match(cancelMeal(state, { userId: 'u2', recordId: consumed.id }, ctxAt(at(10))).errors.form, /cannot be cancelled/);
});

test('breakfast cutoff is the evening before', () => {
  const state = fresh();
  const tomorrowBreakfast = state.mealRecords.find((m) => m.userId === 'u3' && m.date === '2026-10-16' && m.mealType === 'breakfast');
  assert.equal(cancelMeal(state, { userId: 'u3', recordId: tomorrowBreakfast.id }, ctxAt(at(20, 59))).ok, true);
  assert.equal(cancelMeal(state, { userId: 'u3', recordId: tomorrowBreakfast.id }, ctxAt(at(21, 1))).ok, false);
});

test('meals of a plan the admin cancelled cannot be cancelled by the user, and are not counted as user cancellations', () => {
  const state = fresh();
  const dinner = meal(todaysMeals(state, 'u2', TODAY, at(10)), 'dinner').entries[0];
  const admin = cancelSubscription(state, 'SUB-1002', ctxAt(at(10)));
  assert.match(cancelMeal(admin.state, { userId: 'u2', recordId: dinner.id }, ctxAt(at(10))).errors.form, /already cancelled/);
  assert.equal(userSummary(admin.state, 'u2', TODAY).stats.cancelled, 0);
  assert.ok(todaysMeals(admin.state, 'u2', TODAY, at(10)).every((m) => m.status === 'Not Included'));
});

test('admin changes show up for the user (allocation, then credits)', () => {
  const state = fresh();
  const r = allocateSubscription(state, { userId: 'u7', durationMonths: 1, mealTypes: ['lunch', 'dinner'], startDate: TODAY, allocatedMeals: 60 }, ctxAt(at(10)));
  const s = userSummary(r.state, 'u7', TODAY);
  assert.equal(s.stats.remaining, 60);
  assert.equal(s.stats.activeSubscriptions, 1);
  const m = todaysMeals(r.state, 'u7', TODAY, at(10));
  assert.equal(meal(m, 'dinner').entries[0].status, 'Scheduled');
  assert.equal(meal(m, 'breakfast').status, 'Not Included');
});

test('recent activity: newest first, never future dates, cancellation timestamps present', () => {
  const state = fresh();
  const recent = recentMealActivity(state, 'u1', TODAY, 8);
  assert.ok(recent.length > 0 && recent.length <= 8);
  assert.ok(recent.every((m) => m.date <= TODAY && m.userId === 'u1'));
  assert.ok([...recent].every((m, i, a) => i === 0 || a[i - 1].date >= m.date));
  assert.ok(recent.filter((m) => m.status === 'Cancelled').every((m) => m.cancelledAt));
});

test('WhatsApp: encoded message, configured numbers only', () => {
  const msg = renewalMessage({ name: 'Asha Rao', plan: planDetails(fresh().subscriptions.find((s) => s.id === 'SUB-1002')) });
  assert.match(msg, /^Hello, I would like to renew my Dilijith Tiffin Service subscription\. My name is Asha Rao, and my current plan is SUB-1002, 1 month, Lunch, Dinner/);
  const url = buildWhatsappUrl('+91 98765-43210', msg);
  assert.ok(url.startsWith('https://wa.me/919876543210?text='));
  assert.equal(decodeURIComponent(url.split('?text=')[1]), msg);
  assert.ok(!/[ ,&]/.test(url.split('?text=')[1])); // fully encoded
  assert.equal(buildWhatsappUrl('', msg), null);
  assert.equal(buildWhatsappUrl(undefined, msg), null);
  assert.equal(buildWhatsappUrl('910000000000', msg), null); // the old placeholder
  assert.equal(buildWhatsappUrl('12345', msg), null);
  assert.equal(isConfiguredNumber('919876543210'), true);
});

console.log(`\n${passed} tests passed`);
