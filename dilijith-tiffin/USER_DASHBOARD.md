# Customer dashboard

Customers sign in with phone and password. The Express API checks JWTs and loads
MongoDB records; browser storage is not an authentication bypass or source of
meal balances. No offline mutation fallback is provided.

Breakfast, lunch and dinner have independent balances. Scheduling does not
consume a credit; delivery confirmation does. Cancellation before the cutoff
preserves the credit. Cutoffs are Asia/Kolkata: breakfast 9 PM the previous day,
lunch 10 AM the same day, dinner 7 PM the same day. At the deadline cancellation
is closed. Switching browser tabs does not trigger automatic reloads.

Forgot Password opens admin-assisted recovery. There is no automatic email or
SMS delivery. See PASSWORD_RECOVERY.md. Existing accounts and passwords are
unchanged by installing this feature.

Run npm test for logic, authentication, credit, database and recovery checks.
