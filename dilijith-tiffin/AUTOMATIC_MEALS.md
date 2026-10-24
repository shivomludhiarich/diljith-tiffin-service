# Automatic meal accounting

Uncancelled meals consume one credit at their cancellation deadline (IST):
breakfast at 9 PM the previous day, lunch at 10 AM, dinner at 7 PM.
Consumed means charged under this policy, not proof of physical delivery.
The delivery list includes uncancelled meals even after they become consumed,
so kitchen/customer/address/portion information remains available.

Customers can cancel before the cutoff. At or after the cutoff, cancellation
is rejected. A cancelled meal never deducts a credit. Confirmation buttons are
removed; terminal customer-facing outcomes are Consumed and Cancelled.
Internally, future bookings retain the existing Scheduled value until their
cutoff. Its badge is hidden. This preserves cancellability and historical data
without falsely claiming future meals have already been consumed. Existing
legacy records and accounting migration tools are retained.

## Deployment

Set a random **CRON_SECRET** of at least 32 characters in Vercel's Production
environment and redeploy. Keep it server-only. The three daily schedules in
vercel.json call `/api/cron/consume-meals` at 04:30, 13:30 and 15:30 UTC.
Vercel sends `Authorization: Bearer <CRON_SECRET>`; missing/incorrect credentials
are rejected. This cron authentication is separate from customer sessions.

The first authenticated admin/customer data request or authorized cron run
persists an activation timestamp in `mealaccountingpolicies`. Existing bookings
whose cutoffs preceded activation are not retroactively charged. New bookings
created after activation are eligible. Do not delete/reset this timestamp.
No seed, destructive migration, or live database script is required or was run.

Vercel [Hobby cron jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
may run within the scheduled hour, not exactly at the minute. Each of these
jobs runs once daily. Authenticated admin/customer requests also reconcile due
meals before reading/changing data; the open customer dashboard requests an
update when a cutoff passes (its clock checks every 30 seconds). Cold starts
and network delay mean writes are not guaranteed at the exact cutoff second.
The server always uses the exact IST cutoff for cancellation eligibility and
records that cutoff as consumedAt, regardless of scheduler delay.

On a standalone local server, invoke the authenticated cron endpoint with an
external scheduler if no users are active. Never rely on a setInterval inside
a Vercel function. If minute-level unattended processing is required, configure
a suitable scheduler/plan to call the same protected endpoint more frequently.

## Consistency and exceptions

Each transition, credit debit, ledger entry and activity event commits in one
MongoDB transaction. Automatic processing uses the same customer lock as other
credit operations. Repeated and concurrent runs cannot debit the same meal
twice. A unique per-booking operation key provides an additional ledger guard.
No balance is shared across breakfast/lunch/dinner.

Invalid/legacy allocations, cancelled subscriptions, missing customers or
insufficient credits are not force-charged. The scheduler returns a `review`
count for eligible records it cannot process. Investigate those records; do not
invent balances. The processing budget is 15 seconds per invocation; `more:true`
means another invocation is needed. Authenticated requests report catch-up
instead of showing a partially updated balance when that budget is reached.
Historical pre-activation records remain unchanged and may need separate review.

## Verification

`npm run test:automatic` uses a disposable MongoDB replica set to check exact
cutoff boundaries, cancelled/future/historical meals, per-meal balances,
concurrent/repeated runs, catch-up, audit entries, no overspend and cron access.
The main test command includes this suite. Existing explicit-consumption API
fixtures run before a future activation timestamp to test legacy compatibility.
No production scheduler or live customer meal was exercised by these tests.

Validation on 24 October 2026: all 12 main test scripts passed when invoked directly with Node (including the database runner), and the production Vite build passed. The built HTML references the existing logo asset as its favicon. No live deployment was performed.
