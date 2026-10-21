# Customer dashboard (`/user/dashboard`)

## IMPORTANT: no backend exists in this project yet
This repo is still the frontend-only build: React state + `localStorage`, no Express, MongoDB or real login.
So these requirements are **not** met here and need your backend:
- the user is identified by the demo session id (`useAuth().user.id`), not a validated token;
- cancellation rules run in the browser (they are pure functions, see below), not on a server;
- data lives in `localStorage` (key `dts.admin`), shared between admin and customer views of the same browser.

## What is reusable on the server
All rules are in pure, framework-free functions that take the authenticated user's id as an argument:

| Endpoint to build | Function to port | File |
|---|---|---|
| `GET /api/me/dashboard` (stats, expiry, status) | `userSummary(state, userId, today)` | `src/utils/userLogic.js` |
| `GET /api/me/subscriptions` | `userSummary(...).running / .past` | same |
| `GET /api/me/meals/today` | `todaysMeals(state, userId, today, now)` | same |
| `GET /api/me/meals/recent` | `recentMealActivity(state, userId, today, limit)` | same |
| `POST /api/me/meals/:recordId/cancel` | `cancelMeal(state, { userId, recordId }, { today, nowIso })` | same |

The user id must come from the verified token on the server, never from the request body or URL.
Credit maths is `creditMap()` in `src/utils/adminLogic.js` (shared with the admin portal).

## Rules
- Remaining credits = allocated - consumed + net adjustments, per subscription. The "Meals remaining" tile sums only running (Active / Expiring soon) subscriptions; each card still shows its own balance.
- Meals consumed / cancelled tiles also count running subscriptions only. "Cancelled" excludes meals cancelled because the whole plan was cancelled or replaced.
- Cancellation deadlines: `src/config/mealPolicy.js` (breakfast 9 PM the evening before, lunch 9 AM, dinner 3 PM). A meal cancelled in time keeps its credit: it becomes Cancelled and is never counted as Consumed.
- `cancelMeal` rejects: someone else's meal, already cancelled, not Scheduled, inactive plan, deadline passed.

## WhatsApp
Set `VITE_WHATSAPP_NUMBER` in `.env` (see `.env.example`; digits with country code, e.g. `919876543210`) and restart the dev server.
While it is empty (or the old placeholder), no WhatsApp link is generated: the dashboard shows a short configuration note, and the home page "Contact Us" button scrolls to the footer.
The button only opens a chat. Nothing is submitted, approved or paid on the site.

## Trying it
Console, then reload:

    localStorage.setItem('dts.auth', JSON.stringify({ id: 'u1', name: 'Demo Customer', email: 'user@demo.test', role: 'user' })); location.href = '/user/dashboard';

Demo customers: u1 (lunch plan, today's lunch already cancelled), u2 (lunch + dinner, 22 used / 38 left), u3 (expiring, all meals),
u4 (expired only), u5 (cancelled), u6 (two plans, one expired), u7 (no subscription), u8 (expiring).
Cancel buttons depend on the time of day: dinner closes 3 PM, lunch 9 AM.
Open the admin portal in another tab (log in as admin there); changes are picked up across tabs through the `storage` event.

## Tests
`npm test` runs `test:admin` (15 tests) and `test:user` (14 tests) in plain Node.
