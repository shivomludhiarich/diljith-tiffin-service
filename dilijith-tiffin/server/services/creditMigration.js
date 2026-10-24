import { balances } from './credits.js';
// Preview is pure: no database writes, automatic splits, or historical rewrites.
export function previewSubscription(sub, records = []) {
  if (sub.accountingVersion === 2) return { id: String(sub._id), status: 'already_migrated' };
  const review = reason => ({ id: String(sub._id), status: 'review_required', reason });
  if (sub.mealTypes?.length !== 1) return review('Shared multi-meal total has no verified allocation provenance.');
  const mealType = sub.mealTypes[0];
  if (Object.entries(sub.mealCredits || {}).some(([t, c]) => t !== mealType && c && ['allocated', 'consumed', 'adjustments'].some(k => c[k]))) return review('Non-selected meal categories contain historical credits.');
  const allocated = sub.allocatedMeals, consumed = sub.consumedMeals ?? 0, adjustments = sub.approvedAdjustments ?? 0;
  const relevant = records.filter(r => String(r.subscription) === String(sub._id));
  if (relevant.filter(r => r.status === 'Consumed').length !== consumed) return review('Historical consumption does not reconcile with the stored count.');
  if (relevant.some(r => r.mealType !== mealType || String(r.user) !== String(sub.user))) return review('Booking ownership or meal category mismatch.');
  const proposed = { accountingVersion: 2, mealCredits: { [mealType]: { allocated, consumed, adjustments } } };
  if (!balances({ ...sub, ...proposed })) return review('Invalid or negative historical balance.');
  return { id: String(sub._id), status: 'candidate', proposed, openingBalance: allocated - consumed + adjustments };
}
export function previewMigration(subscriptions, records) {
  const servings = new Map();
  for (const r of records.filter(r => r.status !== 'Cancelled')) {
    const key = `${r.user}:${r.date}:${r.mealType}`;
    servings.set(key, [...(servings.get(key) || []), String(r.subscription)]);
  }
  const duplicateSubs = new Set([...servings.values()].filter(v => v.length > 1).flat());
  return subscriptions.map(s => duplicateSubs.has(String(s._id))
    ? { id: String(s._id), status: 'review_required', reason: 'Duplicate customer/date/meal bookings must be resolved without deleting history.' }
    : previewSubscription(s, records));
}
