# Cassia Control - client release handoff

## What is included
- MongoDB-backed role-specific endpoints for orders, kitchen statuses, calls, tasks, inventory, leave and Petpooja reconciliation.
- Password plus Resend login OTP. For isolated demonstrations only, set both CLIENT_DEMO_MODE=true and CLIENT_DEMO_OTP=true on the backend to display a code after successful password verification. This mode is not real 2FA.
- Five-role sample account seeder: `npm run seed:demo -- /path/to/Cassia_Demo_Accounts.private.json`. Use a new, empty, dedicated demo MongoDB database; seeding refuses a populated users collection.
- Original public Cassia website is NOT overwritten.

## Deployment
Render: Root Directory = project folder. Build command `npm install`; start `npm start`. Set `MONGODB_URI` (Render only), `MONGODB_DB` (isolated database), `SESSION_SECRET` (64+ random characters), `CLIENT_DEMO_MODE=true`, `CLIENT_DEMO_OTP=true`, `APP_ORIGIN` to your UI origin, `APP_BASE_URL` to your UI origin, `SESSION_COOKIE_SECURE=true`. The existing three Render variables may be used to construct `MONGODB_URI` there; this app reads the complete `MONGODB_URI` value, not separate credentials.
Vercel: Set Root Directory to this app folder; set RENDER_API_ORIGIN=https://YOUR-RENDER-SERVICE.onrender.com and APP_ORIGIN=https://YOUR-VERCEL-DOMAIN. The app proxies /api calls to Render. Never put MongoDB credentials on the public frontend.

If you instead deploy the entire app directly to Render, there is no Vercel proxy needed.

## Before entering real restaurant orders
Disable CLIENT_DEMO_MODE and CLIENT_DEMO_OTP, configure Resend sender verification, rotate all demo passwords, provision proper individual staff accounts, test kitchen acknowledgements and database backups, and complete outage/failover tests. Offline order synchronization and physical waiter buttons remain outside this release.

## GitHub security
Commit only source, public static assets, package.json, tests, README and `.env.example` with placeholders. Never commit `.env.local`, live DB URI, passwords, API keys, raw OTPs, private PDF, backups or generated demo credential files.

Developer: Swastik Shukla | https://www.instagram.com/swastik_shukla__/
