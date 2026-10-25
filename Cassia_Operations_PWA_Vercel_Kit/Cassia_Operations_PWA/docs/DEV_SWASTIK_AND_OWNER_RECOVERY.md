# Cassia Control · DeV_Swastik and Owner access

## Why "admin" did not log in

The production database has **one active Owner account**. As verified on 25 October 2026, the email stored for that account is `jiking847@gmail.com`. The employee login `staff@gmail.com` belongs to a **waiter**; its permissions are intentionally limited to waiter work. There is no global `admin` password or username.

To switch from a staff account, use **profile → Switch account / sign out**. The email/password login form is now reset properly instead of remaining at an old OTP step.

### Owner sign-in

1. Visit https://cassiams.vercel.app/ and sign out of the employee profile.
2. Sign in with the registered **Owner email** and the associated Owner password.
3. Enter the six-digit OTP. The app never grants Owner access based on the display name "admin".

### If the Owner password is unknown

Choose **Forgot Owner password?** on the sign-in screen.

- **Email recovery:** A one-time recovery code is sent to the existing registered Owner email if the Resend sender is configured and permitted to deliver to it. The code is never displayed on the website, even when supervised demo OTP mode is active.
- **Private Render recovery:** If email cannot be delivered, an authorized Render administrator can set `OWNER_RECOVERY_TOKEN` in the **Render service environment**. Use a **fresh unpredictable value of at least 32 characters**, enter that value with the current Owner email and a **new 12+ character password** in the website's Render recovery form. The token is usable once, and active Owner sessions are revoked.
- **Immediately remove `OWNER_RECOVERY_TOKEN`** from the Render environment after recovery and deploy. Do not commit it, send it by chat or store it in screenshots.

Neither method exposes existing passwords. Staff accounts remain unchanged.

## DeV_Swastik diagnostics

This is a dedicated read-only role, **developer**, and an Owner-only-accessible management screen. The screen contains:

- API uptime, MongoDB ping and active account counts
- Email delivery configuration (configured / not configured; not a proof of actual delivery)
- Sanitized API failures grouped by category and time; event name, HTTP status, timestamp
- Recent operational audit action names (not customer or employee details)
- Local browser request failures observed while this tab is open
- Links to authenticated Render and Vercel dashboards for deployment logs

**Scope:** The in-app list includes captured API incidents only after its release. It cannot show every historical platform exception or all Render/Vercel infrastructure events. It does not read environment secret values, tokens, raw stack traces, private guest records, or employee passwords.

### Create an actual developer login

After signing in as Owner, open **Staff access → Add employee / manager**, choose **Developer · read-only diagnostics**, and create a unique login. The private temporary password is shown only to the Owner. The developer then signs in using their own account and sees **DeV_Swastik**; they cannot make bookings, edit staff, read guests, approve leave, or change inventory.

Existing waiter `swastik` remains a waiter unless the Owner deliberately changes their role. **Do not grant developer access automatically by matching a person's name.**

## Useful checks

- Vercel production: https://vercel.com/dashboard
- Render service and logs: https://dashboard.render.com/
- GitHub code/checks: https://github.com/shashvat25003226-hue/RMS/actions
- Health URL: `https://cassiams.vercel.app/api?health=ready` — should report database connected if the API and MongoDB are available.

For live customer service, Petpooja remains the official billing system and Attendo remains the official attendance source.
