# 00 — Plan

Received 2026-10-04 · due 2026-10-08 (4 days).

## Users
- **Owner / owner's team** — uploads leases, reviews everything, confirms. Primary user.
- **Tenant / inspector** — reports issues with photos (role picked on form; no auth in MVP).

## Flows (separate in time, joined by the unit)
- **A. Lease (at signing):** upload (PDF/DOCX/image) → clauses → extract w/ citations → code checks (quotes, unit match, R1–R7, contradictions) → cards for what needs attention → review loop → owner confirms → active lease, unit `occupied`.
- **B. Issue (during tenancy):** photos + note for a unit → vision assessment (condition, damage, equipment) → agent reads unit's lease (responsibility) → draft work order → review loop → owner confirms.
- **Unit page:** active lease (sources, review state, rule results) + open issues/work orders + links to conversations.
- **Settings:** units + ruleset seeded from `data/`, editable (unit status; rule threshold/severity/enabled), versioned.

## Key decisions
- **Chat is the workflow, unit page is the record.** Agent replies with interactive cards; confirm commits to the unit.
- **Review loop:** click (accept/reject/edit/choose) or type a correction → agent patches only affected fields → rules re-run → reports what changed + what's open → until confirm.
- **Corrections patch, never re-extract.** Accepted fields locked. Typed corrections cited as `source: user` + message id.
- **Model extracts, code decides.** R1–R7, date math, unit match, quote verification are deterministic TS (unit-tested). Rules are parameterised (logic in code; threshold/severity/enabled in DB).
- **Tool calling in the review loop and Part B**; structured output for first extraction. Tools: `search_clauses`, `update_field`, `find_unit`, `evaluate_rules`, `get_unit_lease`, `draft_work_order`, `ask_user`. No tool for confirm/commit/occupancy — user button only. Max ~6 steps/turn, Zod-validated args, every call logged.
- **No judge/second AI** — code checks + human review cover verification; cross-feature reasoning via `get_unit_lease`.
- **Lease input:** PDF (text) and DOCX → text → clauses; image / scanned PDF → vision transcription → clauses + "transcribed from image" flag.
- **Traceability verified:** each field cites `clauseId` + verbatim `quote`; server checks it → unverified = flag.
- **Review state on every AI output:** `pending | accepted | rejected | edited`.
- **Occupancy only on confirm**, high-severity FAIL needs override reason.
- **Ruleset versioned**; each lease review stores the version it was checked against.
- **Storage:** SQLite via Kysely behind repository interfaces → Postgres = dialect + `DATABASE_URL`. DB in `var/`.
- **Provider:** OpenRouter (OpenAI SDK, tool calling + vision) and Stub (scripted from `expected.json` files).
- **UI:** Claude Code-inspired (see CLAUDE.md), built with `/impeccable`.

## Tasks
1. `01-scaffold` — workspace, Express API, Vite web, shared package
2. `02-domain` — schemas + storage + seed
3. `03-model-provider` — provider, tools runtime, OpenRouter + stub
4. `04-lease-agent` — Part A + review loop
5. `05-issue-agent` — Part B
6. `06-ui` — chat with cards, unit page
7. `07-readme` — README, submission
8. `08-settings` — units + rules management (cut if short on time)

## Open questions
- `PRODUCT.md` from `/impeccable init`: commit at root (recommended) or gitignore.

## Product ideas (running log → README)
- Owner template fast path; generate leases in-product; corrections as training signal.
- Move-in inspection baseline → compare at move-out for deposit deductions.
- Natural-language rules → AI proposes structured rule → owner approves → new ruleset version.
