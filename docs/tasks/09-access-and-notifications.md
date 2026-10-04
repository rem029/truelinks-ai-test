# 09 — Access & notifications · Stretch 1–3

Goal: role-based permissions without full auth; tenants report via a per-unit link; owner is notified of new reports.

## Phase 1 — Users & roles
### Tasks
- [x] Test users in `data/users.json` (owner, inspector) — plain-text passwords, test only
- [ ] Simple login page (username + password checked against `users.json`) → random session token (Bearer, kept in memory on the API) → "Signed in as … / Sign out" in header
- [ ] API middleware loads the user from the token — the single swap point for real auth later
- [ ] Login page lists the test accounts so reviewers can switch roles quickly
- [ ] `requireRole(...)` on every route: leases + work-order approval = owner; reports list + create = owner/inspector; public create via token only
- [ ] Unit tests for the permission matrix
### Results
-

## Phase 2 — Tenant report link
### Tasks
- [ ] Each unit gets a random, unguessable report token (created with the unit / on seed)
- [ ] `/report/:token` — mobile-friendly form: photos + note; unit is fixed by the token, not chosen
- [ ] Token can only create a report for its unit; can't read anything
- [ ] Public QR page and signed-in page share one `ReportForm` component (`unitId` fixed vs unit picker); reporter = tenant (public) or the signed-in user
- [ ] Owner can regenerate (revoke) a unit's link; show link + QR on the unit page
- [ ] Simple rate limit per token
### Results
-

## Phase 3 — Notifications
### Tasks
- [ ] On report: AI review runs automatically → notification for the owner with AI summary + draft work order
- [ ] Unusable photo → reporter is asked for a clearer one on the spot (no notification yet)
- [ ] In-app inbox + unread count; opening a notification opens the owner's review conversation
### Results
-
