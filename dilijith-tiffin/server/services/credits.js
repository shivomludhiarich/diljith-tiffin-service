export const MEALS = ['breakfast', 'lunch', 'dinner'];
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function allocations(types, input) {
  if (!Array.isArray(types) || !types.length || new Set(types).size !== types.length || types.some(t => !MEALS.includes(t))) fail('Select valid, distinct meal types.');
  if (!input || Object.keys(input).some(t => !types.includes(t))) fail('Explicit allocations are required for each selected meal.');
  const result = {};
  for (const t of types) {
    const n = input[t];
    if (!Number.isSafeInteger(n) || n < 0 || n > 5000) fail(`${t} allocation must be an integer from 0 to 5000.`);
    result[t] = { allocated: n, consumed: 0, adjustments: 0 };
  }
  return result;
}
export function balances(sub) {
  if (sub.accountingVersion !== 2 || !Array.isArray(sub.mealTypes) || !sub.mealTypes.length || new Set(sub.mealTypes).size !== sub.mealTypes.length || sub.mealTypes.some(t => !MEALS.includes(t))) return null;
  const result = {};
  for (const t of sub.mealTypes) {
    const c = sub.mealCredits?.[t];
    if (!c || !['allocated', 'consumed', 'adjustments'].every(k => Number.isSafeInteger(c[k])) || c.allocated < 0 || c.consumed < 0 || c.allocated + c.adjustments < c.consumed) return null;
    result[t] = { allocated: c.allocated, consumed: c.consumed, adjustments: c.adjustments, entitlement: c.allocated + c.adjustments, remaining: c.allocated + c.adjustments - c.consumed };
  }
  return result;
}
export function requireCredits(sub) {
  const result = balances(sub);
  if (!result) fail('Legacy allocation requires review before credit operations can continue.', 409);
  return result;
}
export function totals(sub) {
  const credits = balances(sub);
  if (!credits) return null;
  return Object.values(credits).reduce((a, c) => {
    for (const k of Object.keys(a)) a[k] += c[k];
    return a;
  }, { allocated: 0, consumed: 0, adjustments: 0, entitlement: 0, remaining: 0 });
}
export function syncTotals(sub) {
  const c = totals(sub);
  if (!c) fail('Invalid per-meal accounting.', 409);
  sub.allocatedMeals = c.allocated;
  sub.consumedMeals = c.consumed;
  sub.approvedAdjustments = c.adjustments;
}
