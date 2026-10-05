# 09 — Access & notifications · Stretch 1–3

Goal: role-based permissions without full auth; tenants report via a per-unit link; owner is notified of new reports.

## Phase 1 — Users & roles (role shortcuts, no login)
Owner's decision (Oct 6): no login form. A reviewer picks a role with one click — **Owner**, **Inspector** or **Tenant** — so they can see each role's view without typing credentials. README → Decisions says why.
### Tasks
- [ ] `data/users.json`: one test user per role, **no passwords** (owner; inspector; tenant tied to a unit, e.g. MC-B-1204)
- [ ] Role picker (first screen, and "Switch role" in the sidebar): three buttons → `POST /api/session { userId }` → random session token (Bearer, kept in memory on the API); sidebar shows "Viewing as …"
- [ ] API middleware loads the user from the token — the single swap point for real auth later
- [ ] `requireRole(...)` on every route: leases + work-order approval = owner; reports list + create = owner/inspector (any unit); tenant = create and list reports for their own unit only, no lease text, no AI responsibility reasoning
- [ ] UI per role: tenant sees only their unit and "Report an issue"; inspector sees units + issues, no lease records
- [ ] Unit tests for the permission matrix
- [ ] README: Decisions bullet (why shortcuts instead of login) + roadmap wording
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
