# Cassia public website + RMS integration

## Live routes

- Customer website and guest bookings: https://cassiams.vercel.app/
- Staff sign-in: https://cassiams.vercel.app/staff
- Public SEO pages: root only. Staff is noindex.
- Same MongoDB backend, separate secure HTTP-only sessions for customers and staff.

## Booking rules

Dine-in: free reservation request (no deposit), name, phone, date, preferred time, 1–20 guests. The request starts **pending**, not confirmed.

Banquet hall: preferred date, available time block, occasion (birthday, anniversary, party, corporate, other), optional **₹1,000 decoration**. No online payment or automatic guarantee is claimed. Slot is held by MongoDB uniqueness for pending/confirmed requests until staff approves/cancels.

Reception, Manager and Owner: **Reservations** in the RMS. They may confirm or decline, contact via WhatsApp deep link, and send Telegram reminder to customers who have linked the bot. Existing **Banquet hall** continues to display banquet entries in its event diary. Waiter, chef and developer cannot access customer reservation review.

Guests can book without an account; a tracking token is displayed and copyable once. Registered customers can see their own bookings, cancel pending requests, update name and phone, change password, and delete their account. Account deletion revokes customer sessions and cancels pending bookings. Confirmed event details are retained temporarily for operational fulfilment; deletion does not secretly cancel a confirmed event.

## REQUIRED Render environment variables

| Key | Example / instruction | Secret? |
|---|---|---|
| MONGODB_URI | Your full MongoDB Atlas connection URI. Existing correct value may remain. | YES |
| MONGODB_DB | cassia_operations | No |
| APP_ORIGIN | https://cassiams.vercel.app | No |
| SESSION_COOKIE_SECURE | true | No |
| OTP_PEPPER | 32+ random characters (existing value should remain unchanged; changing invalidates outstanding OTPs) | YES |
| PUBLIC_WHATSAPP_NUMBER | 8881113210 (10 digits, without +91) | No |

The public customer signup works using a 12+ character password even when Telegram and Resend are unconfigured. It does **not** verify ownership of the claimed email; never describe those email addresses as verified.

## OPTIONAL Telegram integration on Render

| Key | Value | Secret? |
|---|---|---|
| TELEGRAM_BOT_TOKEN | Token from Telegram @BotFather. Do not paste in website code or screenshots. | YES |
| TELEGRAM_BOT_USERNAME | Your bot's public username, without @ | No |
| TELEGRAM_WEBHOOK_SECRET | 20+ random characters using letters, numbers, underscore or hyphen. Configure as Telegram webhook secret_token. | YES |
| TELEGRAM_STAFF_CHAT_ID | Numeric private staff chat/group ID where you want booking notifications, after inviting the bot | Private routing config |

After setting env vars and redeploying, configure the bot webhook once with Telegram Bot API **setWebhook**:
- URL: https://cassiams.vercel.app/api
- secret_token: must match TELEGRAM_WEBHOOK_SECRET

Use your private terminal or a secure API client; avoid putting bot tokens into the chat, GitHub or the public URL. For staff notifications to a group, add the bot to the group and use that group's actual chat ID (negative IDs are valid). Customers must explicitly select **Connect Telegram** from their customer account, open the bot link and press **Start**. Only then will Telegram OTP, booking status updates and manual staff reminders work for that customer. This is not phone-number-based Telegram messaging and **does not send OTP to an unlinked user**.

Telegram booking alerts to staff run on new reservation; linked customers are alerted on confirmation or cancellation. Staff can press Telegram reminder after confirming. Recurring scheduled reminders are not configured by this deployment.

## OPTIONAL existing staff/owner email login settings

| Key | Notes |
|---|---|
| RESEND_API_KEY | Server-side Resend API key for staff OTP email |
| EMAIL_FROM | Sender address on a verified domain |
| OWNER_RECOVERY_TOKEN | Use only temporarily for emergency Owner password recovery; remove after use |
| CLIENT_DEMO_MODE | false |
| CLIENT_DEMO_OTP | false |

Keep \`RENDER_API_ORIGIN\` on **Vercel** pointing to the Render HTTPS service origin (not /api). It is not required on Render. The code intentionally never embeds MongoDB, Telegram or Resend secrets into public HTML.

## Test list before accepting real customers

1. Open root in incognito: normal restaurant site, free dine-in and banquet enquiry form visible.
2. Submit a guest dine-in request: it appears as pending in Reception/Manager/Owner Reservations; WhatsApp link opens prefilled draft, no auto-confirmation.
3. Submit banquet enquiry with decoration checked: ₹1,000 is recorded, no charge collected.
4. Try a second pending banquet enquiry for same date/slot: reject conflict.
5. Confirm and cancel a request from reception: status changes on customer account or tracking link.
6. Customer creates their own login and signs in; only their reservations are visible; they may delete their account.
7. Link Telegram through the bot; verify a one-time login code and receive booking confirmation update.
8. Test on a small phone and with incorrect phone/date/consent; show a clear error and preserve form inputs.

## Development credit
Swastik Shukla · @swastik_shukla__
