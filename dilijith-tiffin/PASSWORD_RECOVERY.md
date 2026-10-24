# Admin-assisted recovery

There is no automated delivery channel. Support must independently verify the
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

No email or SMS is sent. Email delivery code, configuration and dependency were
removed. Shared hashing, validation, session revocation and rate limiting remain.
Customer contact, subscription, credit and delivery data are unchanged.
