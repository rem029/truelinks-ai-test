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
### Results
-

## Phase 3 — Flags, rules, unit
### Tasks
- [ ] Deterministic flags: missing fields, contradictions (term vs dates, annual vs monthly), odd values
- [ ] Rule engine R1–R7, ruleset loaded from DB (seeded) + unit tests against `expected.json`; store ruleset version on result
- [ ] Unit match by id/label/parking bay; none/ambiguous → `unitMatch` card; mismatch with page unit → flag
### Results
-

## Phase 4 — Review loop
### Tasks
- [ ] First reply: summary + cards only for items needing attention; rest collapsed with "Accept all"
- [ ] Card actions → patch record, lock accepted fields
- [ ] Typed message → agent loop with `search_clauses`, `update_field`, `find_unit`, `evaluate_rules`, `ask_user`
- [ ] After each turn: re-run flags + rules, reply with what changed + what's open
- [ ] Confirm (user button only): nothing pending; high-severity FAIL needs override reason; commits lease, unit → `occupied`
- [ ] Unclear correction → agent asks, never guesses
### Results
-
