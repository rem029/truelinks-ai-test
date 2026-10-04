# 02 — Domain & storage

Goal: one set of Zod schemas shared by API, agent output, and UI; persisted.

## Phase 1 — Schemas (`packages/shared`)
### Tasks
- [x] `SourcedField<T>`: value, source `{type: document, clauseId, quote, verified} | {type: user, messageId}`, confidence, review `{status, original?, reviewedAt?}`
- [x] `LeaseRecord`: parties (landlord/tenant + signed), unit ref, commencement/expiry, term_months, rent (amount, frequency, monthly, annual), deposit, escalation `{text, is_defined}`, renewal, termination
- [x] `Flag`, `RuleResult` (`PASS|FAIL|NOT_DETERMINABLE`, reason, clauseIds)
- [x] `Issue` (photos, condition, equipment[]), `WorkOrder` (title, description, unitId, severity, status)
- [x] `Conversation` (kind: lease | issue, unitId?, status: open | confirmed | abandoned), `Message` (role, text, cards[], attachments[])
- [x] `Card` union: `field`, `rule`, `flag`, `unitMatch`, `workOrder`, `summary` — each with its allowed actions
- [ ] (Stretch) `User` (id, name, role: owner | inspector), `ReportLink` (unitId, token, revokedAt?), `Notification` (userId, issueId, summary, readAt?)
- [x] `Action` union: accept / reject / edit(value) / choose(option) / confirm
### Results
- Schemas in `packages/shared/src/`, one file each (`sourcedField`, `severity`, `unit`, `rules`, `flag`, `lease`, `issue`, `conversation`, `cards`, `actions`), exported from `index.ts`. Types are always `z.infer` (no hand-written duplicates).
- `sourcedField(valueSchema)`: value (null = absent), source (`document` clause + quote + verified, or `user` messageId), confidence 0–1, review (`pending|accepted|rejected|edited`, `original` typed as the value).
- One `Severity` enum for rules, flags and work orders. Cards carry no action list; allowed actions come from `ALLOWED_ACTIONS[card.type]` (checked with `satisfies` against the card union).
- Added beyond the list: `Unit`, `Rule`/`Ruleset`, and a `Lease` entity (record + flags + rule results + ruleset version + status + override reason).
- Stretch schemas (User, ReportLink, Notification) not started — Must first.

## Phase 2 — Storage
### Tasks
- [x] Kysely + better-sqlite3; dialect chosen from `DATABASE_URL` (`file:` → SQLite, `postgres://` → Postgres stub/note)
- [x] Repository interfaces in API (`UnitRepository`, `LeaseRepository`, `ConversationRepository`, `IssueRepository`); services depend only on these
- [x] Migrations (portable types): units, rulesets, conversations, messages, leases, issues, work_orders (JSON columns for records/cards); stretch adds users, report_links, notifications
- [x] Idempotent seed: units from `data/units.json`, ruleset from `data/owner_ruleset.json`
### Results
- Kysely 0.29 + better-sqlite3 13 in `apps/api/src/services/db/`: `db.ts` (`file:` → SQLite with WAL + foreign keys; `file::memory:` for tests; `postgres://` → clear "not wired yet" error), `schema.ts`, `migrations/` (static provider, `001_init`), `repositories/` (units, rulesets, leases, conversations, issues + work orders; `createRepositories(db)`), `seed.ts`, `seedCli.ts`.
- `DATABASE_URL` resolved against the repo root once, in `env.ts`. JSON columns parsed with the shared schemas on read; updating a missing row throws `X not found`.
- Seed uses `ON CONFLICT DO NOTHING`, so re-seeding never resets occupancy (tested). Runs on API start; `npm run db:seed` runs it standalone.
- `GET /api/units` (thin route) exposes the seeded units.
- Tests: 35 passing (schema parse/reject, createDb schemes, migrations, seed idempotency + occupancy kept, repository round-trips, `/api/units` on an in-memory DB). Typecheck clean.
- Verified: fresh `var/app.db` → "Seeded 5 units, 1 rulesets", rerun 0/0; `/api/units` via the web proxy returns 5 units, MC-A-0302 and MC-B-1205 occupied.
- Review round with agy: removed duplicate types/enums and per-card action lists, single path resolution, Express 5 async routes without try/catch, updates fail loudly, repositories parse once, `z.iso.*` validators.
- Dev note: a running `tsx watch` can crash mid-edit and not recover; restart `npm run dev` after large changes.
