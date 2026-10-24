# Cassia real-world restaurant pilot checklist

**NOT YET ALL PASSED.** A real pilot needs the following evidence, signed off by owner and manager.

| Test | Required result | Current status |
|---|---|---|
| Double tap waiter Send | One order via idempotency key | Logic/unit level; database concurrency pilot pending |
| Chef offline | Waiter not told kitchen received | State model implemented; offline detection pending |
| OTP replay | Second usage denied | Atomic consume code; real Mongo concurrency test pending |
| Setup link expired/reused | Password change denied | Unit tests passed; connected route pending |
| Wrong-role API request | HTTP 403 | Role gates coded; connected API test pending |
| Real Resend setup email | Inbox delivery after verified sender | Blocked on provider configuration |
| Restaurant router/internet failure | Local server + queue persistence or clear manual fallback | Offline queue not implemented |
| Inventory correction | Actor and reason recorded | Basic code; transaction/audit drill pending |
| Waste without evidence | Rejected based on threshold | Not implemented |
| Staff self-approves waste | Rejected server side | Not implemented |
| Customer opens other table order | No access without private token | Token gate + public filter; live trial pending |
| Unanswered table call | Timely manager escalation | Not implemented |
| Shift tablet not charged | Escalation by deadline | Staff confirmation exists; reminders pending |
| Petpooja receipt match | Manual reference only; no false payment claims | Implemented; real POS reconciliation pilot pending |
| Backup restore | Orders + audits recovered | Not verified |

Go/no-go decision must be made using real results and fallback drills; UI preview success alone is insufficient.
