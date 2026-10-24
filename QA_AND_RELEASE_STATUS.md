# QA and release status — MongoDB + Resend revision

Date: 24 October 2026.

## Verified in this environment

- `npm run check`: 9/9 Node tests passed. Scope: role actions, kitchen transition ordering, password hashing, customer privacy, setup token hashing/TTL/single-use simulated database, OTP HMAC, mocked Resend request and HTTPS setup URL.
- Chromium mock UI test: waiter created order, chef saw kitchen ticket, and no uncaught JS exceptions or horizontal overflow were detected at 320px, 390px or 1280px widths. No backend service was contacted.
- Chromium isolated password form test: setup page rendered, mismatched passwords blocked, simulated successful password submission produced expected API payload and no uncaught JS error.
- Source syntax validated (`node --check`).

## Known constraints / blocked checks

- The current environment's `npm install` of MongoDB dependencies timed out; connected MongoDB integration tests, production app backend test and Vercel build are therefore **not** verified.
- No production Resend key or sender-domain verification was supplied, so no real email was sent or received.
- The first-admin bootstrap CLI requires the owner's trusted environment and is intentionally not run here.
- The secure `/set-password` rewrite is specified in `vercel.json`, but end-to-end routing was not verified on Vercel.
- Offline sync queue, local server, physical table buttons, high-value waste media verification, rewards/coupons, attendance imports, and background escalation are not complete.

## Security improvements against previous Mailjet release

- Mailjet variables/code removed; all transactional email now uses Resend server-only API.
- No initial administrator password stored, generated, printed or sent.
- Token SHA-256 storage; one-use 30 minute setup/invite/reset; no owner HTTP bootstrap route.
- Staff invitations use setup links instead of displaying temporary passwords.
- Correct OTP consumption is atomic, closing concurrent correct-code replay.
- Removed silent `createIndex` failures and repaired time-bucket rate limiting.
- Sensitive password-setup URL removes token from browser address during render; `no-referrer` meta and route header.

**Release verdict:** ready for a connected *staging* deployment, not ready to run a real restaurant shift until the unfinished acceptance tests and external connections are completed.
