# Password recovery

## Email recovery

At /forgot-password, enter the email verified during signup. The same Gmail
SMTP credentials used for signup send a single-use link expiring in 20 minutes.
Configure GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD as described in
EMAIL_VERIFICATION.md. ALLOWED_ORIGIN must be the exact trusted website origin
(for example https://diljit-tiffin-service.vercel.app), without /login or a path.
Redeploy after setting these server-only variables.

Only active accounts with emailVerifiedAt are eligible. Existing unverified
addresses are not trusted for recovery. New public registrations require a
verified email; admin creation requires an email but does not falsely verify it.
Existing records are not migrated or blocked from phone login.

Requests are limited to 3 per email and 10 per IP per 15 minutes. Responses do
not reveal eligibility or claim delivery. SMTP failure removes the failed grant,
logs a generic diagnostic, and keeps the same public response to avoid exposing
accounts. Missing configuration returns 503 with instructions to try again later.
If no message arrives, check spam and try requesting a new link later. SMTP acceptance alone does
not guarantee inbox delivery.

Only SHA-256 token hashes are stored. Links carry the secret in a URL fragment,
which is not sent in HTTP requests; the page removes it from history and keeps
it in memory. Refreshing requires reopening the email link. Requesting another
link replaces the previous grant. Password reset atomically consumes the grant,
updates the bcrypt hash and revokes all old sessions. Phone login is unchanged.
No roles, subscriptions, addresses or meal credits are changed.

Run npm run test:email-recovery for mocked SMTP integration coverage. Real Gmail
inbox delivery must still be checked after the owner configures and deploys it.

## Email-only recovery

Admin-assisted recovery and its API endpoint have been removed. The reset page
requires an emailed token; it never generates a recovery reference. Reset grants
must carry the server-issued email source marker. Older unmarked grants (including
old email links) stop working after this deployment; request a fresh email link.
Accounts without a previously verified email cannot use self-service recovery.
There is no manual password reset fallback or verification bypass.

Login is limited to 50 attempts per IP and 10 per normalized identifier in each
five-minute window. Registration allows 20 per IP and five per identifier in
15-minute windows. Limits are persisted in MongoDB, expire automatically and
return HTTP 429 with Retry-After; they never change account status. All attempts
count, including successful ones. Phone and email identifiers are normalized.
Phone and email aliases have separate counters; the IP cap covers both.
Unknown accounts receive identical throttling. Database failures return 503.
Behind a reverse proxy, configure Express trust proxy for only trusted proxy
addresses; client-controlled forwarding headers are not used by default.
Run npm run test:throttle for expiry, normalization and concurrency checks.

Sessions use a host-only __Host-dts-session cookie with HttpOnly, Secure,
SameSite=Strict and Path=/. JWTs are not returned in login/signup JSON or stored
in localStorage. Clients send credentials with requests. Mutations require an
allowed Origin; set ALLOWED_ORIGIN to the exact frontend origin in production.
Use HTTPS and same-site frontend/API hosting. Logout clears the cookie.
Tests explicitly carry cookies because Node fetch has no browser cookie jar;
cookie flags and origin checks are tested separately by npm run test:cookie.
