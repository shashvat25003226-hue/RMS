# Cassia Control - QA and Release Status

## Passing checks in this package

- Node syntax: `api/index.js`, `lib/core.js`, `public/app.js`.
- Unit tests: role permissions, kitchen lifecycle, scrypt password verification, limited public tracking data (4 passing tests).
- Chromium UI (in-memory isolated preview): mobile 390px viewport; owner -> waiter role switch; create order; switch to chef; kitchen ticket visible; no JavaScript errors; no horizontal overflow.
- Static responsive design includes mobile navigation and tappable 44px actions, owner preview is explicitly identified as sandbox.
- PWA manifest with 192px and 512px icons, HTTPS-aware cookie behavior, service worker avoids caching `/api`.
- Private PDF rendered to 4 pages and checked for readability.

## Not tested against external services

- MongoDB Atlas driver installation and network connectivity from this execution environment.
- Sending a real OTP email through Mailjet, verifying sender/domain.
- Owner bootstrap from a live database; real admin login.
- Vercel deployment and real multi-device connected flows.
- Performance on the restaurant's Wi-Fi or service-shift load.

## Specific behavior and limitations

- A kitchen ticket displays `sent` first. Chef marks `received` explicitly; customer tracking never invents receipt.
- The API rejects wrong-role calls and tracks staff actions in audit records.
- Menu item names come from the uploaded Cassia fine-dine PDF. Staff order tickets are **not official bills**; Petpooja remains official billing, manually reconciled with bill reference.
- Attendo remains separate; no claim of syncing.
- Staff account creation requires a real email; the server generates a unique temporary password and requires OTP. There are no universal shared role defaults.
- Table QR links require a random secret key and may be regenerated.
- Stock item quantities use conditional updates to avoid basic concurrent write overwrites; a full audit-ledger transaction and comprehensive waste media workflow remain for production hardening.
- No reliable offline order queue or restaurant-local server is included. This requires a dedicated architecture and outage testing.

## Before owner pilot

1. Configure Vercel, MongoDB and Mailjet using the separate private owner PDF.
2. Confirm live OTP, role boundaries, data retention, backups and password rotation.
3. Create real table QR links, then test guest calls from multiple phones.
4. Conduct a controlled shift with Petpooja reconciliation.
5. Drill internet outage and power loss; until local/offline work is implemented, use paper/voice fallback.
