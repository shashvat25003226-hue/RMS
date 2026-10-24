# Cassia Control | MongoDB + Resend Release

**Developed by Swastik Shukla · Instagram [@swastik_shukla__](https://instagram.com/swastik_shukla__)**

A mobile-first, installable restaurant operations PWA built from the Cassia Restaurant Management System planning PDF and the subsequent secure MongoDB + Resend build specification.

## What this code actually provides

- Five server-enforced roles: Owner/Admin, Manager, Head Chef, Waiter, Reception.
- Protected password + email-OTP sign-in. Email delivery uses **Resend**, not Mailjet.
- **First admin:** a trusted command reserves `ADMIN_EMAIL`, emails a short-lived single-use setup link; there is **no default password**.
- Owner-invited employees choose their own passwords with single-use Resend links; no temporary passwords shown in HTML.
- Mobile waiter ordering, kitchen acknowledgement / preparation / ready flow, table calls, order tracking link, manual Petpooja bill matching, basic inventory movement recording, tasks, leave and closing checklist.
- Installable web app. Preview mode uses explicitly fictional in-memory data and never connects to real accounts.

## Start locally

```bash
npm install
npm run dev
# Browser: http://localhost:3000/?preview=1
```

The preview works without MongoDB or Resend and **does not create real users or orders**.
For a real app setup, follow [DEPLOYMENT.md](DEPLOYMENT.md). Deployment credentials are never included in the ZIP.

## Admin bootstrap (private trusted terminal)

Configure `MONGODB_URI`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`, `ADMIN_NAME`, and `ADMIN_EMAIL` in a private environment. Use a **new dedicated Cassia MongoDB database**. Then:

```bash
npm run bootstrap:admin
```

This command refuses to replace an existing active owner. It sends a private password setup link to the configured admin email. The link is valid for 30 minutes and single use. **No password is created or printed by this command.** You choose a new 12+ character password on the emailed setup page.

Use HTTPS on the published app for all password and login operations. Email delivery requires a verified sending domain; an accepted Resend API response is not proof that a message arrived in the inbox.

## Status: implemented vs remaining

| Area | Current code | Missing before production use |
|---|---|---|
| Roles and accounts | Permission-gated API, Resend setup/invite/reset links, hashed passwords, email OTP | Real integration test, monitoring, incident review |
| Waiter + kitchen | Order send, idempotency key, kitchen receipt, progression, live refresh | True local-server outage handling and production load tests |
| QR table service | Private per-table token; call request/claim/complete; order tracking token | Print actual QR stickers; alert escalation tuning |
| Petpooja / Attendo | Separate source-system boundaries and manual bill matching | Real authorised exports, reconciliations and attendance imports |
| Inventory | Reasoned adjustments and append-only movement document | Verified waste-media workflows, stock transactions/reconciliation |
| Staff | Tasks, leave, handover, charge confirmation | Attendance history, shift policy, dispute review, alert escalation |
| Loyalty + AI | Not implemented | Explicit future development and testing |
| Offline | PWA shell caches interface files | Local Wi-Fi server; durable queue; conflict/recovery tests |

**Important:** A browser PWA cache does not mean orders can safely reach the kitchen while the network is down. This product must not replace Petpooja billing or Attendo attendance.

## Reference docs

- [Deployment](DEPLOYMENT.md) — Vercel + MongoDB + Resend, setup steps and environment variables
- [Architecture](ARCHITECTURE.md) — modules, identity, order and data design
- [QA status](QA_AND_RELEASE_STATUS.md) — executed tests and unavailable external checks
- [Acceptance checklist](ACCEPTANCE_CHECKLIST.md) — failure scenarios for a real restaurant pilot
