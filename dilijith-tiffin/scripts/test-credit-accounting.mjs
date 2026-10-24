import assert from 'node:assert/strict';
import { allocations, balances, totals } from '../server/services/credits.js';
import { previewMigration } from '../server/services/creditMigration.js';
import { cutoffFor } from '../src/utils/userLogic.js';
const types = ['breakfast', 'lunch', 'dinner'];
const sub = { accountingVersion: 2, mealTypes: types, mealCredits: allocations(types, { breakfast: 20, lunch: 30, dinner: 40 }) };
assert.equal(totals(sub).remaining, 90);
for (const type of types) {
  const copy = structuredClone(sub);
  copy.mealCredits[type].adjustments -= 1;
  for (const t of types) assert.equal(balances(copy)[t].remaining, sub.mealCredits[t].allocated - (t === type ? 1 : 0));
}
for (const n of [-1, 1.2, NaN, Infinity, '20', null]) assert.throws(() => allocations(['lunch'], { lunch: n }));
assert.throws(() => allocations(['snack'], { snack: 1 }));
assert.throws(() => allocations(['lunch', 'lunch'], { lunch: 1 }));
assert.equal(balances({ ...sub, accountingVersion: undefined }), null);
const negative = structuredClone(sub); negative.mealCredits.lunch.consumed = 31;
assert.equal(balances(negative), null);
assert.equal(cutoffFor('2026-10-22', 'dinner').toISOString(), '2026-10-22T13:30:00.000Z');
const old = [{ _id: 'one', user: 'u', mealTypes: ['lunch'], allocatedMeals: 20, consumedMeals: 0 }, { _id: 'two', mealTypes: types, allocatedMeals: 90 }];
const before = JSON.stringify(old);
const preview = previewMigration(old, []);
assert.equal(preview[0].status, 'candidate');
assert.equal(preview[1].status, 'review_required');
assert.equal(JSON.stringify(old), before);
assert.deepEqual(previewMigration(old, []), preview);
console.log('Credit unit checks passed: independent balances, validation, negative balance rejection, IST cutoff, non-mutating migration preview.');
