# Cassia Control - restaurant operations PWA

**Developed by Swastik Shukla (@swastik_shukla__).**

A mobile-first private restaurant workspace built from the Cassia management planning PDF. It uses static HTML/CSS/JS frontend, Vercel Node.js serverless API (`/api/index.js`), MongoDB Atlas collections and Mailjet email OTP. Owner, Manager, Chef, Waiter and Reception roles are enforced **on the server**.

## Safe quick start

1. Run `npm install` (Node 20+).
2. `npm run dev` and open `http://localhost:3000/?preview=1` for an interactive isolated preview. Preview NEVER writes to MongoDB and never grants real access.
3. For connected service: create separate MongoDB Atlas cluster/database, Mailjet account and verified sender, copy `.env.example` to local `.env.local` and supply required values securely. Never commit `.env.local`.
4. Run `npm run seed:owner` **once** with `OWNER_BOOTSTRAP_EMAIL` and `OWNER_BOOTSTRAP_PASSWORD` in the private terminal/local environment. If an owner exists it refuses to overwrite it.
5. Remove bootstrap password from the environment after seeding. Configure production variables at Vercel > Project > Settings > Environment Variables. Publish to a **new protected Cassia Operations project**, not over the public restaurant site.
6. Verify Mailjet email delivery to owner; login requires password AND OTP.
7. Owner creates each staff account with a genuine email via Staff access. A per-person random temporary password appears once in the admin UI. Employees must also receive email OTP.
8. Before a real service pilot, test the failure scenarios in the provided planning document.

## Live operational scope

- Secure login: password (scrypt hash in MongoDB), six-digit single-use email OTP (Mailjet), HttpOnly session cookie, rate limits, server role authorization.
- Waiter: floor orders, idempotency key protection, table calls, served state.
- Chef: kitchen acknowledgement, preparing, ready. No false kitchen-received indicator.
- Reception: manual Petpooja bill reference reconciliation; never marks paid from order status.
- Manager/Owner: tasks, leave review, inventory movement with reason, daily operations metrics and QR table links.
- Guest table QR: call for order/help/bill/urgent; separate secure order tracking token; no other customers' data.
- PWA: installable app shell and responsive layout; it **does not** implement resilient offline order queues yet.

## Deferred safety-critical work

A restaurant-local server, genuinely offline order queue, hardware call buttons, high-value waste video proof and media approvals, staff performance scoring, loyalty points, and automatic Petpooja/Attendo APIs are NOT implemented and must not be marketed as live. MongoDB API and emails require configured credentials and cannot be tested against a live account inside this package alone.

## Where values go

See the **separate private PDF** delivered alongside this ZIP. Do not upload that password/setup PDF to the website, GitHub or Vercel project files. The ZIP intentionally contains no real passwords or API keys.

## How to rotate a user password

An owner can create new staff accounts with temporary passwords, but the current version does **not** expose self-service password-change UI. Rotate through a secure administrative procedure or an added authenticated change-password endpoint before the real pilot. Bootstrap owner credentials should be replaced before staff enrollment.

## Operational warning

This is a working source implementation and interactive local preview, not a completed production installation. Connected login, Mailjet delivery, Atlas network access, backups, reliability and hardware are deployment requirements. Do not use it to replace Petpooja billing or Attendo attendance.
