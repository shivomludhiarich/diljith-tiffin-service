# Single-project Vercel deployment

Set the Vercel **Root Directory** to `dilijith-tiffin`, the directory containing
`package.json`, `vite.config.js`, and `vercel.json`. Choose Vite, Node.js 22,
build command `npm run build`, and output directory `dist`.

`api/index.js` exports a Node request/response handler and reuses the existing
Express app. The first rewrite sends `/api` and `/api/*` to this function;
the SPA fallback explicitly excludes that namespace. Existing static files
take precedence over rewrites. No Next.js-style catch-all filename or adapter
is required. The function does not call `listen`; `npm run server` retains the
local listener. These choices follow the official [Node runtime](https://vercel.com/docs/functions/runtimes/node-js),
[Vite](https://vercel.com/docs/frameworks/frontend/vite), and
[rewrites](https://vercel.com/docs/rewrites) documentation.

## Environment

Configure these in Vercel project settings, separately for each environment:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Server-only MongoDB connection string |
| `MONGODB_DB_NAME` | Existing database name; defaults to `dilijith_tiffin` |
| `CRON_SECRET` | Random server-only secret of at least 32 characters for automatic consumption jobs |
| `JWT_SECRET` | Random secret of at least 32 characters; placeholders rejected |
| `ALLOWED_ORIGIN` | Exact HTTPS frontend origin, without a trailing slash |
| `VITE_API_URL` | `/api`, or leave unset; never use localhost in production |
| `VITE_WHATSAPP_NUMBER` | Public business WhatsApp number |

Vercel supplies the production Node environment. Validation runs on API
initialization; invalid settings return a generic JSON 503. The database must
allow connections from the deployment and support replica-set transactions
(Atlas does). Review Atlas network access for your deployment's egress setup.
No secrets belong in any `VITE_*` variable or committed environment file.
Frontend variables are baked into the build: changing them requires rebuilding.

Use a separate test database for previews. Set `ALLOWED_ORIGIN` to the exact
preview origin before testing writes; other origins intentionally fail. This
configuration allows one canonical origin per environment, not arbitrary
preview domains. Route alternate domains to the canonical domain.

## Authentication and local development

Login uses the existing phone/password flow. JWTs are stored only in the
`__Host-dts-session` cookie with HttpOnly, Secure, SameSite=Strict, and Path=/.
The client includes credentials. Mutations require an allowed Origin and reject
cross-site fetches. CORS configuration lives in `server/app.js`; CSRF checks live
in `server/middleware/sessionCookie.js`. Neither trusts arbitrary hostnames.

On Vercel only, Express trusts one proxy hop for rate-limit IPs: Vercel
[overwrites forwarded IP headers](https://vercel.com/docs/headers/request-headers).
Do not set `VERCEL=1` on a directly exposed local/custom server. Additional
upstream proxies can cause customers to share a rate-limit bucket.

Locally copy `.env.example` to `.env`, supply your development database and JWT
secret, run `npm run server` and `npm run dev`. Vite proxies `/api` to port 5000.
Remove an old `VITE_API_URL=http://localhost:5000/api` override to use that proxy.
Cookies retain Secure locally; use localhost in a browser supporting its secure
context exception, or local HTTPS. Do not disable cookie security for deployment.

## Data safety

Startup and deployment never seed, clean, reset, or migrate data. No schema or
historical meal-balance migration is needed. Existing migration tools remain.
For an empty disposable development database only, explicitly set
`ENABLE_DEMO_SEED=true`, `SEED_ADMIN_PHONE`, and `SEED_ADMIN_PASSWORD` (12+ characters),
then run `npm run seed:dev`. This command is disabled in production and on
Vercel. It skips populated databases. Never point it at customer data.

MongoDB connections and pending connection attempts are reused per warm function
instance, with a pool of five and ten-second connection timeouts. Rejected
attempts are cleared so a later request can retry. Each Vercel instance has its
own pool; monitor Atlas connection limits when scaling. Health returns 503 when
connection/initialization fails, never a fabricated success.

## Verification

`npm test` includes the function/connection test alongside authentication,
recovery, throttling, customer/admin, and meal-accounting suites. Database tests
use disposable local MongoDB instances. `npm run build` builds the frontend.

After deployment, verify `/api/health` returns JSON and a connected database;
`/api/unknown` returns JSON 404; `/api/auth/me` without a cookie returns 401;
and direct navigation/refresh on `/login`, `/dashboard`, `/admin` loads the SPA.
Using test accounts, verify login/logout, cookie flags, admin/customer access,
subscription allocation, independent meal balances, cancellation/consumption,
recipient lists, and assisted recovery. Check cold and warm requests. Local
Node tests do not prove Vercel CDN rewrites or browser cookie behavior in a live
deployment. No deployment or live database modifications were performed here.

Local verification on 2026-10-24: all eleven scripts listed by the main test
command passed (including the database runner's two suites). The Vite production
build passed with `VITE_API_URL=/api`. The available npm installation was missing
its test/run command modules, so the same scripts and Vite CLI were invoked
directly using Node; `npm test` itself could not run in this environment.
Existing Mongoose `new` option deprecation warnings remain. The lockfile was
refreshed using npm with scripts disabled to restore Linux optional build
dependencies needed on Vercel. The function tests were rerun after final error
handling edits and passed.

Automatic cutoff accounting and scheduler timing limitations are documented in [AUTOMATIC_MEALS.md](AUTOMATIC_MEALS.md).
