# Admin portal

Sign in using an existing administrator's phone and password. There is no demo
authentication bypass or default password. Backend routes enforce JWT and admin
authorization; editing browser storage cannot grant server access.

Users and Subscriptions load authoritative MongoDB data through AdminDataContext.
Customer details show contact information, delivery address, subscriptions and
individual meal balances. Allocations select one meal type at a time. Delivery
confirmation consumes one credit. See CREDIT_ACCOUNTING.md for accounting rules.

Admin-created customers require an explicit password and always receive the user
role, regardless of request fields. Existing passwords are never retrievable.
The Reset Password action approves customer-assisted recovery after identity
verification. See PASSWORD_RECOVERY.md for the manual procedure.

Run npm test and npm run build. Database tests use isolated disposable MongoDB
instances. Never clear live collections or run seed scripts to troubleshoot UI.
