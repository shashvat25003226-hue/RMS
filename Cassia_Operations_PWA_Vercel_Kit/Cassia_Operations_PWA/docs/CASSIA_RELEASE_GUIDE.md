# Cassia Control — Restaurant management release guide

**Developer credit:** Swastik Shukla · @swastik_shukla__  
**Website:** https://cassiams.vercel.app/  
**Status:** Deployed for supervised client walkthrough. Production reconciliation, physical-stock verification, role logins and mobile testing are required before a live restaurant shift.

## What the owner can do
- Create and disable accounts, set temporary employee passwords and assign staff roles.
- See recorded attendance (Attendo import or owner correction) and apply an owner-signed present / absent correction without deleting original records.
- See team and personal leave calendars. CL policy: **10 approved casual days per employee per calendar year**; paid leave is a separate *request type*, not a payroll payment.
- Approve or decline leave. Staff manually designated **high performer** require **owner** approval.
- Award monthly recognition points, certificates or optional discretionary team perks. This is not an automatic wage or disciplinary system.
- Confirm actual selling prices for dishes based on Petpooja.
- Import Petpooja or Attendo CSV rows for human review.

## Reception workflow
Use Petpooja for all official bills and payments. Reception can import Petpooja billing exports and create a pending batch. **Managers/owner verify those rows**. Cassia does not automatically mark invoices as paid or change any POS billing.

## Attendo import workflow
Attendo continues recording original attendance. Export a CSV. The receptionist, owner or manager can stage the file. The owner or manager verifies each row against an active staff email. After verification it appears in the Cassia calendar. Corrections made by the owner are recorded separately, without rewriting Attendo data.

### CSV formats supported
The CSV import supports **up to 40 rows per upload**, with comma-separated headings; split larger exports into multiple files. The browser validates records before staging them.

Petpooja example:
```csv
bill_number,date,amount
P-1001,2026-10-25,1299.00
P-1002,2026-10-25,785.00
```

Attendo example:
```csv
email,date,status
waiter@example.com,2026-10-25,present
chef@example.com,2026-10-25,absent
```
Accepted Attendo statuses: present, absent, leave, half_day, late. Dates use YYYY-MM-DD. Change the example emails to actual Cassia staff logins.

**Important:** These are examples, not real imported invoices or actual attendance.

## Menu and inventory
- A printable **menu-book view** contains category SVG illustrations, dish checkboxes and Cassia's venue photo. Print → **Save as PDF**.
- Seven Indian breads were added, including roti, butter roti, naan, butter naan, garlic naan and paratha. Their example prices are visibly **unverified** until the owner confirms real prices in Petpooja.
- The recipe showcase has 27 recipes and 22 illustrative ingredient rows, scaled for five portions of each recipe. Those are kept in `demo_recipes` and `demo_stock` rather than the real `stock` collection.
- Waiter readiness hints are **simulated** and must be confirmed by the head chef before accepting the order. Kitchen may mark sold-out items.
- Production inventory remains separate and requires physical counts with logged reasons.

## Individual roles
| Role | Tasks |
|---|---|
| Owner | All management and owner-only actions including attendance corrections and staff awards |
| Manager | Orders, tasks, stock, report verification, leave approvals except owner-protected high performers |
| Head chef | Kitchen tickets, availability, stock movements, assigned tasks |
| Waiter | Orders, guest mobile lookup, table help, order progress, attendance and leave |
| Reception | POS reconciliation, private guest lookup, file uploads, guest calls, leave |

## Live updates
New notifications and view data update while the page is open. Mobile requests are throttled to reduce device lag. An automatic refresh is **not** a substitute for server push, guaranteed background alerts or local-first offline storage.

## Before operating live
1. Create actual staff accounts and verify that every role only sees authorized records.
2. Review and verify every menu dish and selling price against Petpooja.
3. Record real ingredient quantities and chef-approved recipes.
4. Import and review Attendo export mappings and a Petpooja billing report.
5. Run a supervised order from waiter → kitchen → ready → served → reception, including duplicate-send testing.
6. Test on an Android phone and iPhone at real venue Wi-Fi strength. Verify Service Worker is updated.
7. Validate CL approvals, payroll policy and monthly recognition with restaurant leadership.
8. Set up MongoDB backup and verify restore. No live offline LAN server is included yet.

All demonstration data are explicitly labeled and are not evidence of revenue, physical inventory or employee performance.
