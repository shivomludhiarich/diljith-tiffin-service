# Admin portal

Routes (all behind `ProtectedRoute role="admin"`, rendered in `AdminLayout`):
`/admin/dashboard`, `/admin/users`, `/admin/subscriptions` (`/admin` redirects to the dashboard).

## Reaching it without the login page
Open the browser console on any page of the running app and run:

    localStorage.setItem('dts.auth', JSON.stringify({ id: 'a1', name: 'Demo Admin', email: 'admin@demo.test', role: 'admin' })); location.href = '/admin/dashboard';

If your login page already offers the demo admin role, use that instead.

## Where things live
| Concern | File |
|---|---|
| All meal / credit / status rules and commands | `src/utils/adminLogic.js` (pure functions, no React) |
| Date maths (end date, month clamping) | `src/utils/dates.js` |
| Shared state + localStorage (`dts.admin`) | `src/context/AdminDataContext.jsx` |
| Demo data (generated relative to today) | `src/data/adminSeed.js`, `src/data/mockUsers.js` |
| Pricing shown in the allocation form | existing `src/data/mockPlans.js` via `src/utils/pricing.js` |

## Rules worth knowing
- remaining = allocated - consumed + net adjustments. Only meal records with status "Consumed" reduce it. Scheduled, Cancelled and Missed never do.
- Subscription status is derived from dates: Cancelled (stored), else Expired (end date before today), else Expiring soon (ends within 7 days), else Active.
- End date = start + N months - 1 day (15 Oct + 1 month ends 14 Nov).
- Allocating over a live plan cancels the old one (kept on record) and cancels its future meals.
- Renewing extends the same subscription from the day after its end date (or from today if expired), adds the plan's default meals as a "Renewal" adjustment, and logs a renewal entry. Unused credits carry over.
- Cancelling keeps the subscription and every meal record; future scheduled meals become Cancelled.

## Tests and reset
- `npm run test:admin` runs the accounting tests (plain Node).
- Reset demo data: clear the `dts.admin` key in localStorage and refresh (or call `reset()` from `useAdminData()`).
