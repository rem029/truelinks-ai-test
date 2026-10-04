# 02 — Domain & storage

Goal: one set of Zod schemas shared by API, agent output, and UI; persisted.

## Phase 1 — Schemas (`packages/shared`)
### Tasks
- [ ] `SourcedField<T>`: value, source `{type: document, clauseId, quote, verified} | {type: user, messageId}`, confidence, review `{status, original?, reviewedAt?}`
- [ ] `LeaseRecord`: parties (landlord/tenant + signed), unit ref, commencement/expiry, term_months, rent (amount, frequency, monthly, annual), deposit, escalation `{text, is_defined}`, renewal, termination
- [ ] `Flag`, `RuleResult` (`PASS|FAIL|NOT_DETERMINABLE`, reason, clauseIds)
- [ ] `Issue` (photos, condition, equipment[]), `WorkOrder` (title, description, unitId, severity, status)
- [ ] `Conversation` (kind: lease | issue, unitId?, status: open | confirmed | abandoned), `Message` (role, text, cards[], attachments[])
- [ ] `Card` union: `field`, `rule`, `flag`, `unitMatch`, `workOrder`, `summary` — each with its allowed actions
- [ ] `Action` union: accept / reject / edit(value) / choose(option) / confirm
### Results
-

## Phase 2 — Storage
### Tasks
- [ ] Kysely + better-sqlite3; dialect chosen from `DATABASE_URL` (`file:` → SQLite, `postgres://` → Postgres stub/note)
- [ ] Repository interfaces in API (`UnitRepository`, `LeaseRepository`, `ConversationRepository`, `IssueRepository`); services depend only on these
- [ ] Migrations (portable types): units, rulesets, conversations, messages, leases, issues, work_orders (JSON columns for records/cards)
- [ ] Idempotent seed: units from `data/units.json`, ruleset from `data/owner_ruleset.json`
### Results
-
