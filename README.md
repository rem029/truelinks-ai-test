# TrueLinks Lease & Issue Agents

A small full-stack service where AI agents turn a lease document into a structured, verifiable lease record, validate it against an owner's rules, and turn property photos into draft work orders — all linked to the unit.

> Work in progress.

## Repository layout

```
apps/api          Express 5 API (TypeScript)
apps/web          Vite + React UI (TypeScript)
packages/shared   Shared types / schemas
data/             Owner ruleset, units, sample leases & photos
scripts/          Dev utilities (sample data generation)
```

## Sample data

- `data/owner_ruleset.json`, `data/units.json` — provided with the brief.
- `data/sample-leases/` — generated test leases (PDF), each designed to exercise specific rules. Regenerate with `npm run samples:leases`.

| File | Unit | Exercises |
|---|---|---|
| `lease-01-clean-MC-B-1204.pdf` | MC-B-1204 (available) | Happy path — all rules PASS |
| `lease-02-problems-MC-B-0902.pdf` | MC-B-0902 | R1, R2, R4, R5, R6 FAIL; unit matched by label + parking bay (no unit ID) |
| `lease-03-occupied-MC-B-1205.pdf` | MC-B-1205 (occupied) | R3 (48-month term), R7 (unit occupied) FAIL |
| `lease-04-quarterly-no-deposit-MC-A-0301.pdf` | MC-A-0301 | Quarterly rent normalisation; no deposit → R1 NOT_DETERMINABLE |
| `lease-05-unknown-unit-rent-conflict.pdf` | Tower C (not in records) | R7 FAIL; conflicting monthly rent (8,500 vs 8,000) must be flagged, not silently resolved |

`data/sample-leases/expected.json` holds the expected rule outcomes and flags per lease, used by tests and the stub model provider.

- `data/sample-photos/` — AI-generated issue photos (none were provided with the brief; prompts in `PROMPTS.md`). `expected.json` was written from what each photo actually shows, not from the prompts.

| Scenario | Unit | Exercises |
|---|---|---|
| `issue-01-ac-leak` | MC-B-1204 | Split AC leaking, wall stain, puddle → HVAC work order; landlord responsible (lease 01 §7) |
| `issue-02-tap-drip` | MC-B-0902 | Two faults: dripping tap + corroded drain. Responsibility is split (lease 02 §7: tenant pays minor repairs under QAR 500), so the agent should surface it, not decide |
| `issue-03-water-heater` | MC-A-0301 | Corroded, leaking water heater with exposed wiring and a wet socket → high severity, urgent safety advice |
| `issue-04-move-in-ok` | MC-B-1204 | New, undamaged rooms → equipment inventory, "no issue found", no work order (no false positives) |
| `issue-05-unclear` | MC-A-0301 | Dark, blurry photo → agent asks for a clearer one instead of guessing |

## How it works

**Users.** The property owner and their team upload leases and review everything. Tenants and inspectors report issues with photos.

**Two flows, joined by the unit.** They happen at different times: a lease at signing, an issue at any point during the tenancy.

- **Lease:** upload (PDF, DOCX or image) → split into clauses → AI extracts each field with its clause and quote → code checks quotes, matches the unit and runs rules R1–R7 → the agent asks about what needs attention → the owner corrects and confirms → the lease becomes the unit's active lease and the unit is marked occupied.
- **Issue:** photos and a note for a unit → AI assesses condition, damage and equipment → the agent reads the unit's lease to see who is responsible for the repair → draft work order → the owner corrects and confirms.
- **Unit page:** the active lease (with sources and rule results) and the open issues and work orders, with links back to each conversation.

## Decisions

- **Review happens in a chat, and the result is saved to the unit.** The user uploads a lease or photos into a conversation. The agent replies with interactive cards (fields with their source quote, flags, rule results, a draft work order). The user accepts, rejects or edits a card, or types a correction in plain language. The agent updates only the affected fields, runs the rules again, says what changed and asks about whatever is still open. This repeats until the user confirms. The confirmed result is saved to the unit, and the unit page links back to the conversation.
- **A correction changes only the fields it mentions; the agent never re-reads the whole lease.** Accepted fields are locked. Re-reading the lease on every turn could quietly change values the user already approved, because model output varies from run to run. A typed correction is recorded with the user's message as its source, so the record stays traceable.
- **The model extracts and code decides.** Rules R1–R7, date calculations, unit matching and quote checks are plain TypeScript with unit tests. The rule logic lives in code; the owner can change each rule's threshold, severity and on/off state. Every lease review records which ruleset version it was checked against.
- **Tool calling where the agent has to decide; fixed steps elsewhere.** The first extraction is a single structured-output call. In the review loop and the issue flow, the agent chooses among tools: `search_clauses`, `update_field`, `find_unit`, `evaluate_rules`, `get_unit_lease`, `draft_work_order`, `ask_user`. There is no tool for confirming, saving or changing occupancy; only the user's button does that. Tool arguments are schema-checked, each turn is capped at about 6 steps, and every call is logged.
- **No second "judge" AI.** Code checks and human review already cover verification more reliably, at no extra cost or delay. The useful cross-checking (for example, who pays for a repair) happens through `get_unit_lease`.
- **Leases in any common format.** PDF and DOCX are converted to text and split into clauses. Images and scanned PDFs are transcribed by the vision model and flagged as "transcribed from image", because their citations can only be checked against the model's own transcription.
- **Occupancy changes only when the user confirms.** If a high-severity rule fails, confirming needs an override reason.
- **No fixed lease template.** The agent reads whatever lease is uploaded. Leases come from many sources (old leases, broker drafts, other templates), so the AI does the reading and a person corrects it. Every extracted field can be accepted, rejected or edited, and the rules run again on the corrected values.
- **SQLite now, with the database kept swappable.** SQLite needs no server: `npm install` and it runs, which matters for reviewers starting the project. To keep the database replaceable:
  - The app's logic talks to *repository interfaces* (`UnitRepository`, `LeaseRepository`, …), never to a database driver.
  - The repositories use [Kysely](https://kysely.dev), a typed SQL query builder that supports SQLite, Postgres and MySQL. Switching databases means changing the dialect in one file and setting `DATABASE_URL`, not rewriting queries.
  - Migrations stick to portable SQL types. Structured records (a lease's extracted fields, chat cards) go in JSON columns: `TEXT` in SQLite, `jsonb` in Postgres.
  - **Trade-off:** SQLite allows only one writer at a time, so it's the first thing to replace when there are many users. That's the first item under "Where it breaks first at scale".
- **Few dependencies, all actively maintained and widely used.** Every package must have a recent release, strong weekly downloads and TypeScript types. For example, PDFs are read with `unpdf` (built on Mozilla's pdf.js, released in the last few months), not the better-known `pdf-parse`, whose last release is almost a year old.
- **Term length counts the expiry date as inclusive.** A lease from 1 Nov 2026 to 31 Oct 2028 is 24 months. Rule R4 uses this convention.

## Where it breaks first at scale

1. **SQLite allows one writer at a time.** Many owners reviewing and many tenants reporting at once would queue on writes. Fix: switch the Kysely dialect to Postgres.

## Product ideas

_Collected as we build._

- **Fast path for the owner's own template.** Read leases on the owner's standard template with plain code and send everything else to the AI agent.
- **Create leases inside the product.** Build the lease from a structured record and produce the PDF from it. There's nothing to extract, and the rules are checked before signing, not after.
- **Move-in inspection.** Photograph the unit when the lease starts to record its condition, then compare the move-out photos against it to support or dispute deposit deductions.
- **Rules in plain language.** The owner writes a rule ("3BR units must include parking"); the AI proposes a structured rule; the owner approves it and it becomes a new ruleset version.
- **Learn from corrections.** Log every correction (which field, value before and after, where the lease came from) to measure extraction accuracy and find where the agent is weak.
