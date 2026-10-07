# 09 — Access & notifications · Stretch 1–3

Goal: role-based permissions without full auth; tenants report via a per-unit link; owner is notified of new reports.

## Phase 1 — Users & roles (role shortcuts, no login)
Split to stay within 15 files: **1a** API users + session + middleware that loads the user, no enforcement (~9 files); **1b** `requireRole` on every route + tenant scoping (~11); **1c** role picker screen, per-role navigation, e2e helper that picks a role in every spec (~15, tight: split again if the skeleton shows more).
Owner's decision (Oct 6): no login form. A reviewer picks a role with one click — **Owner**, **Inspector** or **Tenant** — so they can see each role's view without typing credentials. README → Decisions says why.
### Tasks
- [ ] `data/users.json`: one test user per role, **no passwords** (owner; inspector; tenant tied to a unit, e.g. MC-B-1204)
- [ ] Role picker (first screen, and "Switch role" in the sidebar): three buttons → `POST /api/session { userId }` → random session token (Bearer, kept in memory on the API); sidebar shows "Viewing as …"
- [ ] API middleware loads the user from the token — the single swap point for real auth later
- [ ] `requireRole(...)` on every route: leases + work-order approval = owner; reports list + create = owner/inspector (any unit); tenant = create and list reports for their own unit only, no lease text, no AI responsibility reasoning
- [ ] UI per role: tenant sees only their unit and "Report an issue"; inspector sees units + issues, no lease records
- [ ] e2e specs for the permission matrix (no unit tests, see CLAUDE.md → Testing)
- [ ] README: Decisions bullet (why shortcuts instead of login) + roadmap wording
### Results
-

## Phase 2 — Tenant report link
Split: **2a** API: per-unit token, public report route, rate limit (~10 files); **2b** UI: shared `ReportForm`, QR on the unit page, regenerate (~13; needs a QR package, to be approved).
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
Split: **3a** API: notification created on report, list and mark read (~10 files); **3b** UI: inbox and unread count (~8).
### Tasks
- [ ] On report: AI review runs automatically → notification for the owner with AI summary + draft work order
- [ ] Unusable photo → reporter is asked for a clearer one on the spot (no notification yet)
- [ ] In-app inbox + unread count; opening a notification opens the owner's review conversation
### Results
-
