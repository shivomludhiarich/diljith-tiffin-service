# Signup email verification through Gmail SMTP

New public signups must verify their email before the account is created.
The user enters an email, selects Send verification code, enters the emailed
six-digit code, selects Verify email, then completes signup. Phone/password
login remains unchanged. Existing accounts are not blocked or migrated.
Administrator-created customer accounts retain their existing creation flow;
they are not falsely marked as email-verified. Verified accounts can also request email password recovery; see PASSWORD_RECOVERY.md.
Admin-assisted recovery remains available for accounts without a verified email.

## Gmail and Vercel setup

1. Choose the Gmail account that should send verification emails. It may be
   `rajwinderra1998@gmail.com` if that is the account you control.
2. Enable 2-Step Verification on that Google account.
3. Create a dedicated App Password at https://myaccount.google.com/apppasswords
   (name it Diljit Tiffin Service). Use the App Password, not your normal Gmail
   password. Some managed/Advanced Protection accounts do not offer App Passwords;
   if unavailable, this password-based setup cannot be used as configured.
4. In Vercel Settings → Environment Variables, add to Production:

   ```env
   GMAIL_SMTP_USER=your-sending-address@gmail.com
   GMAIL_SMTP_APP_PASSWORD=your-google-app-password
   ```

5. Push the updated application and redeploy. For local development only, put
   the values in the ignored `.env` file. Never prefix these names with VITE_,
   commit them, paste them into chat, or expose them in browser code.
6. On the deployed signup page, request a code for an address you control.
   Check inbox/spam, verify it and complete signup with a designated test account.

The code uses smtp.gmail.com, port 465, with TLS. The sender is the authenticated
Gmail account; no arbitrary From address or client-specified email text is used.
An SMTP acceptance means Google accepted the message, not that inbox delivery
is guaranteed. Gmail quotas and account restrictions still apply.

References: [Google App Passwords](https://support.google.com/accounts/answer/185833)
and [Gmail SMTP](https://developers.google.com/workspace/gmail/imap/imap-smtp).

## Security and failure behavior

- Codes expire in 10 minutes and permit at most five verification attempts.
- Only an HMAC of the code is stored, keyed with the server JWT secret; neither
  codes nor SMTP credentials are logged or returned by the send endpoint.
- Sending is limited to 3 requests per email and 10 per IP per 15 minutes.
  Verification checks are also limited by IP. Resending invalidates the old grant.
- Successful verification returns a random, short-lived registration grant.
  The frontend keeps it in component memory, never persistent browser storage.
  Only its hash is stored. The grant is bound to the exact normalized email.
- Registration atomically consumes the grant and creates the customer using a
  MongoDB transaction. Replays, expired grants and concurrent reuse are rejected.
  Role is always assigned by the server; supplied verification flags are ignored.
- The account is created only after verification and still stores a bcrypt hash.
  No login cookie is issued by either email endpoint. Normal signup issues the
  existing secure HttpOnly cookie after the account has been created.
- The temporary emailverification collection has TTL cleanup; expiry is also
  enforced in queries, so delayed cleanup cannot extend validity.
- Missing SMTP configuration and SMTP failures return an honest error. Signup
  cannot bypass verification if email delivery is unavailable. Existing login,
  admin operations and recovery continue to work without SMTP configuration.

## Tests and deployment limits

`npm run test:email` uses a disposable MongoDB replica set and a mocked SMTP
transport: expiry, wrong-code limits, rate limits, normalization, single-use
grants, concurrent signup, resend invalidation, missing configuration, SMTP
failures, password hashing, role protection, phone login and existing accounts.
It makes no outbound email deliveries. The existing auth/integration suites
use preverified email fixtures; there is no verification bypass in application
code. Real Gmail credentials, Google account access and live inbox delivery
cannot be validated until the owner configures the environment variables.
