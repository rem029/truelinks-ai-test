# 11 — Unit leases · one lease in effect per unit

Goal: an occupied unit is backed by a confirmed lease the owner can see; new leases are checked against it by dates.

## Phase 1 — Current and next lease
### Design
- A unit's confirmed leases are placed on a timeline by their dates (pure `unitLeases.ts`): **active** = in effect today, **next** = starts after today. No extra column: `leases.unit_id` + `status` + the term dates already relate them, and confirm guarantees no two confirmed leases on a unit overlap.
- **R7** compares dates instead of only the occupancy flag: overlap with a confirmed lease → FAIL naming the tenant and term; starts after the current lease ends → PASS ("next lease"); missing dates → NOT_DETERMINABLE; occupied with no lease on record → FAIL.
- **Duplicate flag** (`DUPLICATE_LEASE`, high): same tenant, commencement date and monthly rent as a confirmed lease on the unit.
- **Confirm** refuses an overlap outright (409, no override): only one lease can be in effect. It marks the unit occupied only when the lease is in effect today; a next lease leaves the unit as it is.
- **Seed:** occupied units in `data/units.json` get their current lease from `data/current-leases/` (generated PDFs). The seed runs the real pipeline (ingest → extract → accept all → confirm) on the stub model, so the record has clauses and quotes and opens like any review. Confirm uses the override "Existing tenancy imported from the owner's records".
- **API:** `GET /api/units/:unitId/leases` → `{ active, next }` lease summaries.
- **Work order agent:** `get_unit_lease` (`findConfirmedLease`) currently takes the newest confirmed lease by `confirmedAt`, which would pick a *next* lease over the one in effect. Switch it to the active lease (in effect today).
- **Agent:** `get_unit_leases` tool for the lease review agent, so "when does the current tenant leave?" has an answer.
- **UI:** unit page shows a "Current lease" panel (tenant, term with months left, monthly rent, deposit, link to the record) and "Next lease" when there is one.
### Tasks
- [ ] Current-lease PDFs + stub records; seed them
- [ ] `unitLeases.ts`; R7 by dates; duplicate flag; confirm overlap block + occupancy only when in effect
- [ ] `GET /api/units/:unitId/leases`; `get_unit_leases` tool
- [ ] Unit page current/next lease panel
- [ ] e2e: seeded current lease on the unit page; lease 07 passes R7 as next lease; lease 03 fails R7 by overlap
### Results
-

## Phase 2 — Archive and delete lease reviews
Owner request: "archive if it's not active; once archived, only then we can delete".
### Design
- **Archive** a lease review when it is a draft never confirmed, or a confirmed lease that has ended (neither the unit's active nor next lease). The active and next lease can't be archived (409).
- Archived reviews leave the unit's Lease records tab and the Unassigned list; an "Archived" filter shows them. **Unarchive** brings one back.
- **Delete** only an archived review: removes the conversation, messages, uploaded file and lease record, after an in-app confirmation. Refused (409) while a work order references the lease, so a repair keeps the lease it was judged against.
- Conversation status gains `archived` (migration); deleting is a hard delete in one transaction, file removed after commit.
### Tasks
- [ ] `archived` status + archive/unarchive/delete endpoints with the rules above
- [ ] UI: archive/unarchive/delete actions on the lease thread and review rows; Archived filter
- [ ] e2e: archive a draft, delete it; active lease can't be archived
### Results
-

## Phase 3 — Status filters on the unit tabs
Owner request: filter lease records and issues by status so a conversation is found without scrolling.
### Design
- A row of filter chips above each list, each with its count; "All" first, and a chip with 0 items is hidden.
  - **Lease records:** Active, Next, Draft, Ended, Archived (Archived replaces the separate filter from phase 2).
  - **Issues:** Needs review (work order draft), Accepted, Rejected, No work order; plus an "Urgent" toggle.
- The filter lives in the URL (`#/u/<unitId>/leases?status=draft`), so Back and shared links keep it; the default is everything except archived.
- Filtering happens in the browser on the summaries already loaded (`GET /api/conversations`); no new endpoint until lists get long (then server-side paging, noted in README scale section).
- Chips are real toggle buttons (`aria-pressed`), keyboard reachable, and the list says how many it shows ("3 of 9").
### Tasks
- [ ] Router: optional `status` query on the unit route
- [ ] Filter chips + counts on Lease records and Issues; empty-filter message with a "Show all" button
- [ ] e2e: filter lease records to Draft, issues to Accepted
### Results
-
