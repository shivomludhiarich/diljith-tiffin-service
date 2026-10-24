# Meal credit accounting

## Audit and decisions

The previous Subscription model stored shared allocatedMeals, consumedMeals and approvedAdjustments counters. Its save hook silently split missing mealCredits by the number of meals. Allocation and adjustments also divided shared quantities; the customer UI copied subscription totals into each meal category. Browser state could report success after an API failure. There was no delivery debit endpoint or atomic ledger.

The administrator now selects **one meal type per allocation**, as requested. Separate allocations support independent breakfast, lunch and dinner plans. The API rejects multiple selected types and requires `mealAllocations: { lunch: 30 }`, for example; it does not reinterpret `allocatedMeals` requests. Verified historical multi-meal documents can still be represented without merging their balances.

For accountingVersion 2, each mealCredits entry stores allocated, consumed and adjustments. Remaining equals allocated + adjustments - consumed. Aggregate fields are compatibility totals only, refreshed from those entries. Responses include backend-calculated per-meal balances. Unverified historical records return review-required status and no invented balance.

## Atomic operations and policy

Allocation/replacement, adjustment, delivery, cancellation and renewal use MongoDB transactions, a per-customer write lock, durable operation receipts, and a unique ledger operation/meal index. Every mutation requires a stable opId. Reusing that ID with identical input returns the committed result; different input is rejected. Distinct requests cannot consume the same booking twice or overdraw a meal balance. A standalone MongoDB deployment returns 503 without partial accounting writes; deploy a replica set or Atlas.

Versioned bookings have a database-unique customer/date/meal serving key. Cancelled bookings release that key while preserving history. Scheduling also checks legacy bookings. Replacement explicitly confirms loss of access to **all** credits on conflicting subscriptions; it preserves their documents and history. Different meal subscriptions remain independent.

Existing cancellation policy is retained: breakfast before 21:00 the previous day, lunch before 10:00, dinner before 19:00, all Asia/Kolkata. Scheduling does not debit credits. A timely cancellation records a zero-delta preservation entry, not a refund that creates an extra credit. Delivered, missed and late meals cannot be cancelled through the customer endpoint. The existing policy does not debit missed meals.

Existing renewal policy adds durationMonths * 30 credits to each included category, extends the same subscription, and keeps its unused credits and consumed counters. It does not copy carried balances into another allocation. The ledger retains the original allocation and expiry, plus renewal's previous/new expiry. Renewal is allowed within seven days of expiry or afterward, and rejects overlapping allocations. No cross-customer credit transfer exists.

## Files and endpoints

- Models: Subscription, MealRecord, User (serialization lock), CreditLedger, CreditOperation. Existing CreditAdjustment history is preserved.
- Services: credits.js (validation/read model), creditMigration.js (read-only classification).
- Controllers: creditController.js (transactional commands), adminController.js and userController.js (authoritative responses).
- Existing allocation, adjustment, renewal, subscription cancellation and customer cancellation routes are extended. `POST /api/admin/meals/:id/consume` is new because no delivery mutation endpoint existed.
- UI: admin allocation/adjustment/detail/delivery views, AdminDataContext, customer dashboard, subscription display, API client and India-time policy helpers.

## Migration rollout

No live database has been migrated. Production records have not been inspected; conclusions are based on repository schemas, seed fixtures and historical code. Do not run seed/reset scripts to migrate data.

1. Take a database backup and export a JSON snapshot containing raw `subscriptions` and `mealRecords` arrays (ObjectIds and dates serialized to strings). Keep customer and adjustment history in the full database backup.
2. Run `node scripts/preview-credit-migration.mjs snapshot.json`. This only reads the file. Single-meal records with valid counters and matching historical consumed records are candidates. Multi-meal records, duplicate servings, mismatched ownership, inconsistent counts and invalid balances require review. Automatically split fields are not proof of original entitlement.
3. Obtain approval for the concrete reviewed mapping. Multi-meal allocations still need external evidence; the one-meal UI decision does not determine old balances.
4. Only after approval, set explicit CREDIT_MIGRATION_URI and CREDIT_MIGRATION_DB and run `node scripts/migrate-single-meal-credits.mjs snapshot.json --apply`. The tool verifies each source document against the backup, rechecks current bookings, upgrades only unambiguous single-meal records, and writes a unique opening ledger entry in a transaction. Re-running skips version 2 documents. It does not delete or split records. Multi-meal migration intentionally remains blocked pending mapping decisions.
5. Reconcile per subscription and meal: sum CreditLedger.delta must equal allocated + adjustments - consumed. Check consumed booking counts against consumed counters; review historical discrepancies instead of rewriting history. `migration_opening` represents net historical balance, so pre-migration consumption is retained in source records rather than replayed as new debits.

## Verification

`npm test` runs existing logic suites, new accounting checks, isolated API/concurrency tests, and the existing auth/integration suites against disposable MongoDB replica sets. The first database run downloads a MongoDB binary. Existing database scripts now refuse to use the app database implicitly. `npm run build` verifies the frontend production bundle.

Legacy browser-only logic remains for demo fixture tests, but authenticated mutation and dashboard paths never execute it as a network fallback. Migration approval and verification against an actual production export remain deployment prerequisites.

### Results from this implementation

Passed: existing admin logic (15), user logic (14), allocation logic (20), authentication (19), and database integration (22) checks. New accounting, dashboard rendering, concurrency, ledger rollback/reconciliation, and migration rerun checks passed against a disposable MongoDB replica set. The production build and whitespace diff check passed. No live migration, seed, reset, or production data modification was performed. Browser interaction was not manually exercised; UI verification used component rendering and the production build.
