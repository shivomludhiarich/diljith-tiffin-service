> Updated 25 October 2026: automatic consumption and admin warnings are restored. Sunday is now a non-service day. New Sunday-specific regression tests cover scheduling, cancellation rejection, delivery counts, customer UI and Monday breakfast processing on Sunday evening.

# Production readiness review — 24 October 2026

Verdict: core automated checks pass, but unattended production operation is not
fully verified. A supervised pilot is more appropriate than an unconditional
production sign-off until the items below are resolved.

## Executed checks

All 13 scripts passed using Node directly (the 12 main-command scripts plus
test-admin-page-loading.mjs). The available npm installation previously lacked
its run/test modules; this review does not claim that `npm test` itself ran.

- Admin/customer logic and single-meal allocations.
- Independent meal balances, credit validation and non-mutating migration preview.
- Customer dashboard rendering and cancellation button cutoff boundaries.
- MongoDB-backed authorization, ownership, concurrency, idempotency, renewal,
  delivery accounting, and ledger reconciliation.
- Signup, phone login, password hashing, and rejection of role escalation.
- Admin-assisted recovery, expiry/replay rejection and session revocation.
- Login/registration rate limits, normalization and automatic expiry.
- Secure/HttpOnly/SameSite cookie flags, Origin rejection and logout clearing.
- Vercel handler environment validation, connection reuse/retry and JSON failures.
- Automatic consumption at all three IST cutoffs; future/cancelled/historical
  exclusions, repeated/concurrent runs, insufficient-credit protection and cron
  authorization.
- Admin Users/Subscriptions render without triggering a refresh loop.

Added and passed a transaction-failure regression: a deliberately failed ledger
write rolls back the meal status, debit and activity event; a later retry charges
exactly once. Tests use disposable local MongoDB replica sets, not customer data.

Production Vite build passed with VITE_API_URL=/api. Existing Mongoose deprecation
and SSR test warnings were not test failures. No application behavior was changed
as part of this review; only the rollback regression and this report were added.

## Live, unauthenticated checks

Checked https://diljit-tiffin-service.vercel.app:

| Path | Observed result |
| --- | --- |
| /, /login, /admin, /dashboard | 200, frontend HTML |
| /api/health | 200, database connected |
| /api/auth/me | 401 |
| /api/admin/state | 401 |
| /api/unknown | 404, JSON |
| /api/cron/consume-meals | 401 without a secret |

The admin page's HTML response does not grant admin data access: its API correctly
rejects unauthenticated requests. The cron result indicates its secret passes
the server's minimum configuration check; it does not prove scheduled executions
are happening or completing. No authenticated production requests or mutations
were performed, and no real meal was consumed/cancelled by this review.

## Before unattended production use

1. Accounting warning gap addressed: failed meal processing now persists a reason
   and appears in an admin-only banner with customer, meal and date details.
   The banner refreshes without reloading the page, reports catch-up and refresh
   failures, and clears resolved meals. Tests cover authorization, persistence,
   duplicate prevention, successful retry and rendering. Deploy this change to
   make the warning system available on the live site.
2. Verify successful cron executions in Vercel logs at all three meal cutoffs.
   Check the response's review and more fields. Processing stops at its time
   budget; more=true requires a later invocation. Hobby scheduling can be late,
   and a healthy API alone is not evidence of working unattended accounting.
3. Run an authorized browser acceptance flow with designated test accounts on
   the deployed domain: signup/login/logout, customer and admin access, plan
   allocation, pre-cutoff cancellation, post-cutoff automatic consumption,
   delivery recipient lists and password recovery. Existing tests exercise the
   APIs and server rendering, not a complete real-browser interaction journey.
4. Confirm database backups and a restore procedure before relying on the service
   for real customer balances. Backup availability was not inspected here.

Additional limits: no load/capacity test, dependency vulnerability audit, external
penetration test, or production restore test was performed. The preserved
pre-activation meal records also need business review if they contain outstanding
historical deliveries; this review did not inspect or change them.
