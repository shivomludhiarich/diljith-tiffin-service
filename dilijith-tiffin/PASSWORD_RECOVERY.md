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
accounts. Missing configuration returns 503 with assisted recovery instructions.
If no message arrives, check spam or contact support. SMTP acceptance alone does
not guarantee inbox delivery.

Only SHA-256 token hashes are stored. Links carry the secret in a URL fragment,
which is not sent in HTTP requests; the page removes it from history and keeps
it in memory. Refreshing requires reopening the email link. Requesting another
link replaces the previous grant. Password reset atomically consumes the grant,
updates the bcrypt hash and revokes all old sessions. Phone login is unchanged.
No roles, subscriptions, addresses or meal credits are changed.

Run npm run test:email-recovery for mocked SMTP integration coverage. Real Gmail
inbox delivery must still be checked after the owner configures and deploys it.

## Admin-assisted fallback

For customers without a verified email or working email delivery, Support must independently verify the
customer's identity using its established process; knowing a phone number or
address alone is not proof. The customer opens /reset-password on their own
device and gives the displayed reference directly to the verified administrator.
The admin selects that customer's details, confirms identity and approves the
reference with Reset Password. The customer then enters their new password on
the same page within 20 minutes. Refreshing loses the private secret and requires
a new approval. Do not accept references forwarded by unrelated third parties.

The browser generates a random 256-bit secret and displays only its SHA-256
hash as the reference. No API response or log contains the secret or password.
Only the hash is stored on the customer record. The server atomically changes
the bcrypt password hash, removes the grant and increments the JWT version.
Older sessions are rejected by existing authorization middleware. New approvals
replace old grants. Expiry is checked explicitly. HTTPS is required in production.

The assisted flow sends no email or SMS. Shared hashing, validation, session
revocation and rate limiting remain.
Customer contact, subscription, credit and delivery data are unchanged.

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
