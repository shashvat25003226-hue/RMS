# Cassia Control — Vercel / MongoDB / Resend deployment

**Use a new private Vercel project for operations.** Do not replace the public restaurant website at cassiarestro.vercel.app. The private operations interface intentionally carries `noindex` metadata.

## 1. Services and permissions

1. Create or select a **dedicated** MongoDB Atlas database for Cassia Control. Use a least-privileged database user. Obtain a URI securely from Atlas; never paste it in code or a public chat.
2. Configure Atlas network access for the server environment. Avoid broad production allowlists when a more restrictive or private connection is available; Vercel egress must be considered. Enable backups and document restore procedure.
3. In Resend, add and verify a sending domain. Choose a sender such as `Cassia Control <login@YOUR-DOMAIN>`. A Vercel app domain alone does not establish Resend sender verification.
4. Deploy this repository to a **new** Vercel project using Node 20+. Keep your existing public restaurant website deployed separately.
5. In Vercel Project Settings > Environment Variables, add the server-only values below. Scope to appropriate Preview/Production environments. **Do not prefix secrets with `NEXT_PUBLIC_` or `VITE_`.**

## 2. Environment variables

| Name | Where to find / example | Secret? |
|---|---|---|
| `MONGODB_URI` | Atlas Connect > Drivers URI | YES |
| `MONGODB_DB` | `cassia_operations` | No |
| `RESEND_API_KEY` | Resend > API Keys | YES |
| `EMAIL_FROM` | Verified email sender on your domain | No, but privileged configuration |
| `APP_BASE_URL` | HTTPS URL of the *private* operations app (no trailing slash) | No |
| `ADMIN_NAME` | `Swastik Shukla` | No |
| `ADMIN_EMAIL` | `swastikshukla522@gmail.com` | No |
| `SESSION_SECRET` | Generate 64+ random characters privately | YES |
| `NODE_ENV` | `production` | No |
| `SESSION_COOKIE_SECURE` | `true` | No |

Do not commit `.env.local` or use Vercel environment variables in browser JavaScript. The application requires an actual MongoDB user with write access to collections and indexes.

## 3. First owner email

From a trusted machine with the source checked out, install dependencies and set the real variables in a **private terminal/secret manager**. Then run:

```
npm run bootstrap:admin
```

The command creates only a *pending* owner account and sends a one-use 30-minute setup link via Resend. It does not generate a reusable default password, reveal the token, or permit owner account creation via an HTTP endpoint. Check Resend delivery activity if no email arrives. Only after clicking the email link, setting a new password and signing in with email OTP should the app be considered accessible.

If an owner already exists, the command refuses to override it. Resolve this with an audited, authorised database recovery procedure, not by creating a public bootstrap endpoint.

## 4. Staff invitation and login

- In the owner Staff access screen, invite a real staff email and role.
- The server creates an inactive account, asks Resend to send a single-use invitation link, and activates it only after the employee sets a password.
- A failed sender request leaves the account inactive; owner may resend invitation. Do not claim delivery from a browser toast alone.
- Login: password step, then six-digit email OTP valid for 10 minutes. A valid OTP can be consumed only once.
- Password reset: generic message to avoid confirming whether an email exists; only actual active accounts receive a short-lived reset link.

## 5. Before production traffic

1. Test real Mail delivery for setup, invite, reset and OTP (verified domain).
2. Test MongoDB writes, indexes, users, idempotent orders, table token issuance and role-denied API requests across devices.
3. Test SSL, HttpOnly secure cookies, expired and reused tokens, admin token replay, bad logins and rate limits.
4. Test restaurant Wi-Fi dropouts and print a paper/voice fallback, because offline orders are **not yet implemented**.
5. Configure backups, monitoring, staff training and actual tablet/QR hardware.
6. Pilot in parallel with Petpooja and Attendo. Do not treat a served ticket as a paid bill.

For API reference: routes are grouped under `/api` and accept `{action:"..."}` JSON. Never call admin-only actions from guest accounts. Authorization is enforced server-side.
