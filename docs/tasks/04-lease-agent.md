# 04 — Lease agent (Part A) · Must

Goal: upload lease in chat → sourced record, flags, rule results, unit match → review loop → confirm → committed to unit.

## Phase 1 — Ingest
### Tasks
- [ ] Upload in conversation: PDF (unpdf), DOCX (mammoth, if quick) → text → numbered clauses
- [ ] (Stretch #3) Image / scanned PDF → vision transcription into clauses + "transcribed from image" flag
- [ ] Optional unit context (upload started from a unit page)
- [x] Sample leases in `data/sample-leases/`
### Results
- 5 PDFs + `expected.json` (ground truth per rule) via `npm run samples:leases` (`scripts/generate-sample-leases.mjs`, pdfkit).
- Term convention: expiry date is inclusive (1 Nov 2026 → 31 Oct 2028 = 24 months). R4 must use this.
- Lease 05 has a deliberate rent conflict (8,500 vs 8,000) — extraction must flag, not pick silently.

## Phase 2 — Extract + verify
### Tasks
- [ ] Structured-output call: fields with clauseId + verbatim quote, null when absent; conflicts returned as candidates
- [ ] Verify each quote exists in its clause → unverified = flag
- [ ] Currency: amounts must be in QAR. If the currency is missing or isn't QAR, flag it (high) and ask the owner. Never convert silently.
### Results
-

## Phase 3 — Flags, rules, unit
### Tasks
- [x] Deterministic flags: missing fields, contradictions (term vs dates, annual vs monthly), odd values
- [x] Rule engine R1–R7, ruleset loaded from DB (seeded) + unit tests against `expected.json`; store ruleset version on result
- [x] Unit match by unit ID only; otherwise the owner confirms through a `unitMatch` card with suggestions (page unit, label, parking bay); mismatch with page unit → flag
### Results
- New `apps/api/src/services/leases/`. Everything is pure except `evaluateLease.ts`.
  - `leaseTerm.ts` `monthsBetween`: inclusive expiry, UTC. It returns null when the span isn't a whole number of months or the expiry isn't after the start.
  - `rent.ts`: `monthlyRent` uses the stated monthly rent, or divides quarterly or annual rent down and marks it `derived`. `compareAnnualRent` allows 1 unit of tolerance, and R6 and the flag both use it.
  - `unitMatch.ts` `matchUnit(record, units, pageUnitId)` returns `matched` (only when the stated unit ID is in the records) or `unconfirmed` with suggestions: the page unit, units whose label appears in the premises text, and units with the same parking bay.
  - `rules.ts` `evaluateRules`: one check per rule id. The ruleset supplies which rules run, their severity and `rulesetVersion`. A missing value gives NOT_DETERMINABLE, and so does a rule with no check.
  - `flags.ts` `detectFlags`: small functions per kind (missing field, term, rent, signature, odd value, unit), each with a stable `code` and `id`.
  - `leaseFields.ts`: shared `formatMoney` and `getClauseIds`.
  - `evaluateLease.ts`: loads `rulesets.getLatest()` (throws if nothing is seeded) and `units.list()`. It returns `{unitMatch, ruleResults, flags, rulesetVersion}` and logs `lease evaluate ruleset=… unit=… rules=P/F/ND flags=n ms`.
- **Decision:** flags cover data quality only. A policy breach (term over 36 months, an occupied unit) appears as a rule result, so it isn't shown twice. Some of the `expected.json` flag strings ("Unit is currently occupied", "Term 48 months exceeds 36…") are therefore covered by R7 and R3 instead. "Renewal terms vague" needs judgement, so it comes from the model in phase 2. Phase 2 also flags the lease 05 rent conflict (8,500 vs 8,000) from the extraction candidates. The fixture uses clause 2's 8,500, which is what makes R1 and R6 PASS as expected.
- `seed.ts` now exports `loadUnits()` and `loadRuleset()` (domain types). Seeding and the tests use the same loaders.
- `sampleLeaseRecords.ts`: one `LeaseRecord` fixture per sample lease, with verbatim quotes. Clause ids are `parties`, `premises`, `1`…`8` and `signatures`. **For phase 1:** clause splitting must produce the same ids.
- **Decision (owner):** only the unit ID is trusted for an automatic match. Without an ID, or with one that isn't in the records, the owner confirms the unit from a list of suggestions. R7 is NOT_DETERMINABLE until they do, or FAIL if there is nothing to suggest. The choice is saved as `unit.unitId` with the user's message as its source, so the next evaluation simply matches. This also removes the problem of matching on how the model formats the label. `expected.json` and the lease generator script were updated: lease 02's R7 is now NOT_DETERMINABLE, and its flag reads "owner to confirm (suggested MC-B-0902)".
- **Known limits:**
  - A span that isn't whole months (for example a start on 31 January) fails R4 for a person to review.
- **Tests:** term, rent, unit match, rules (all 5 leases × R1–R7 against `expected.json`), flags, and `evaluateLease` on an in-memory seeded DB. 153 tests pass in total; typecheck is clean.
- **End-to-end:** I ran `evaluateLease` for all 5 fixtures against the seeded dev DB. Every rule status matches `expected.json`. For lease 02, once the owner picks MC-B-0902, R7 becomes PASS.

## Phase 4 — Review loop
### Tasks
- [ ] First reply: summary + cards only for items needing attention; rest collapsed with "Accept all"
- [ ] Card actions → patch record, lock accepted fields
- [ ] Typed message → agent loop with `search_clauses`, `update_field`, `find_unit`, `evaluate_rules`, `ask_user`
- [ ] After each turn: re-run flags + rules, reply with what changed + what's open
- [ ] Confirm (user button only): nothing pending; high-severity FAIL needs override reason; commits lease, unit → `occupied`
- [ ] Unclear correction → agent asks, never guesses
- [ ] Storage: a `tool_calls_json` column on `messages` (tool calls, plus model, tokens and time per assistant message). Indexes: `messages(conversation_id, created_at)`, and `unit_id` on `leases`, `issues` and `work_orders`.
### Results
-
