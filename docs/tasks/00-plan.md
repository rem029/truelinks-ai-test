# 00 — Plan

Received 2026-10-04 (planning day) · build 2026-10-05 → 2026-10-07 · polish + submit 2026-10-08.

**Rule: build the brief's minimum requirements first. Nothing from Stretch starts until every Must item works end-to-end with the stub provider.**
Long-term vision: a property management system (tickets, roles, notifications). That's the README roadmap, not this build.

## Must — brief requirements (deliver in 4 days)
**Part A — Lease record** (owner)
- Upload lease (PDF; DOCX if quick) → clauses → AI extracts parties, unit, dates, rent (amount + frequency), deposit, escalation, renewal, termination — each with clause + quote
- Code: quote verification, flags (missing / contradictions / odd values), rules R1–R7 (PASS / FAIL / NOT_DETERMINABLE + reason + clause), unit match
- Human accepts / rejects / edits each field and flag; typed corrections via a small tool loop
- Confirm → lease linked to unit, unit occupancy updated (high-severity FAIL needs override reason)

**Part B — Issue report**
- Upload 1..n photos for a unit (+ note, reporter role: tenant/inspector as a field)
- AI: condition (new / worn / damaged / undeterminable), damages, equipment; reads unit's lease for responsibility; drafts work order (title, what's wrong, unit, severity)
- Human accepts / rejects / edits the work order; unclear photo → asks for another; no issue → no draft

**Together**
- Units list + unit page: lease (sources, review state, rule results) + issues and work orders in one place

**Engineering**
- Stub provider (runs with no key) + OpenRouter provider; unit tests for rules, dates, matching, quote checks
- README: how to run, decisions, left out, where it breaks at scale, product ideas, API requirements

## Stretch — only if Must is done (in this order; numbers = README roadmap)
1. Test login + roles (roadmap 1 · `09` phase 1) — `data/users.json` already exists
2. Public QR report page per unit sharing one `ReportForm` (roadmap 2 · `09` phase 2)
3. In-app notifications (roadmap 4 · `09` phase 3)
4. Settings: units + rule thresholds, ruleset versioning (roadmap 5 · `08`)
5. Image / scanned-PDF leases (roadmap 6)
6. Issue approval workflow: its own table for approval steps and status history (Submitted → Awaiting owner → In progress → Resolved), linked to `issues` and `work_orders`. Statuses are as in README → Roadmap.
7. Migration backup: back up before a pending migration, restore on failure, delete on success (`10`)

## Later — README roadmap only (not built)
All ideas are kept and ranked in README → "Roadmap: toward a property management system" (12 items: tickets, notifications by email/WhatsApp, move-in inspection, corrections as training signal, SLAs/contractors/analytics, template fast path, in-product lease generation, natural-language rules, …). Add new ideas there, not here.

## Schedule
| Day | Date | Goal | Tasks |
|---|---|---|---|
| 0 | Oct 4 | Plan, sample data | done |
| 1 | Oct 5 | Foundations: runs end-to-end, rules tested | `01` scaffold · `02` schemas + SQLite + seed · `03` provider (stub + OpenRouter) · rule engine + tests (`04` phase 3) |
| 2 | Oct 6 | Part A complete | `04` ingest → extract → verify → review loop → confirm · lease review UI (`06` phase 1) |
| 3 | Oct 7 | Part B + unit page | `05` · units list + unit page (`06` phase 2) · test with a real OpenRouter key |
| 4 | Oct 8 | Polish + submit | `/impeccable` pass · README final · fresh-clone run check · stretch only if time · send email |

## Key decisions (summary — details in README)
- Model extracts, code decides, human confirms. No tool can confirm or change occupancy.
- Chat-style review with cards; corrections patch only affected fields; accepted fields locked.
- Tool calling only where the agent decides (corrections, issue review); first extraction is one structured call.
- SQLite via Kysely behind repository interfaces; swappable DB.
- Few, well-maintained dependencies.

## Open questions
- `PRODUCT.md` from `/impeccable init`: commit at root (recommended).
