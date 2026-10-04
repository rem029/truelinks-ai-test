# 04 — Lease agent (Part A) · Must

Goal: upload lease in chat → sourced record, flags, rule results, unit match → review loop → confirm → committed to unit.

## Phase 1 — Ingest
### Tasks
- [x] Upload in conversation: PDF (unpdf), DOCX (mammoth, if quick) → text → numbered clauses
- [x] Track pages: the PDF is read page by page (unpdf), and each clause stores `{id, heading, text, page}`. A clause that spans pages stores where it starts and where it ends. Keep the original file so the UI can open it at that page. DOCX has no reliable page numbers, so its clauses have none.
- [x] (Stretch #3) Image → vision transcription into clauses, document marked `textSource: image` (scanned PDF still rejected)
- [x] AI heading detection when the rules find no numbered heading; owner checks an `ai`/`paragraphs` split
- [x] Samples: multi-page PDF, DOCX, image, inline headings
- [x] Optional unit context (upload started from a unit page)
- [x] Sample leases in `data/sample-leases/`
### Results
- 5 PDFs + `expected.json` (ground truth per rule) via `npm run samples:leases` (`scripts/generate-sample-leases.mjs`, pdfkit).
- Term convention: expiry date is inclusive (1 Nov 2026 → 31 Oct 2028 = 24 months). R4 must use this.
- Lease 05 has a deliberate rent conflict (8,500 vs 8,000) — extraction must flag, not pick silently.
- **Ingest** (`apps/api/src/services/leases/ingest/`):
  - `readDocument.ts` reads a PDF page by page (unpdf) or a DOCX as one block (mammoth). `SUPPORTED_MIME_TYPES` is the only list of accepted types, and it also gives the stored file extension.
  - `splitClauses.ts` is pure and returns `{clauses, usedFallback}`.
    - A numbered heading counts only when it is the next number in sequence, so "1 November 2026" on a wrapped line isn't a heading.
    - Short all-caps lines are sections (slug ids; a repeated slug gets `-2`, `-3`). The first line is always the title and goes into `preamble`.
    - With no headings, it falls back to paragraphs (`p1`…).
    - Lines are joined with a space, except after a trailing hyphen: pdfkit wraps `MC-\nB-1204`.
    - Each clause stores `pages: {start, end}` (null for DOCX).
  - `ingestLease.ts` checks the conversation is an open lease conversation and the type is supported. It rejects a document with no text (422, "scanned PDFs are not supported yet"), saves the original as `<documentId>.pdf|.docx` in `UPLOAD_DIR`, stores the document and adds a user message with the attachment. It logs `lease ingest … pages= clauses= fallback= ms=`.
- **Storage:** migration `002_documents` adds a `documents` table (clauses as JSON, `file_path` relative to `UPLOAD_DIR`). `documentRepository` is in `Repositories`. The shared types are `Clause`, `PageRange` and `LeaseDocument`.
- **API:**
  - `POST /api/conversations`: `{kind, unitId?}`; an unknown unit gives 400. This is the unit context.
  - `GET /api/conversations/:id`: conversation, messages and documents.
  - `POST /api/conversations/:id/lease-document`: multer, in memory, 10 MB.
  - `GET /api/documents/:id/file`: inline, so the UI can open `#page=N`. A missing file gives 404 without leaking the server path.
  - Errors: a small `HttpError` (status + details), handled by the one error handler. A `MulterError` gives 400.
- **Tests:** splitter cases (sequence guard, preamble, pages across two pages, duplicate slugs, both fallbacks, null pages, hyphen join). All 5 sample PDFs split into `preamble, parties, premises, 1..n, signatures`, and **every quote in `sampleLeaseRecords` is found in the clause it cites**: the phase 2 quote check depends on this. The API tests cover create, upload, GET, the file bytes, a .txt upload (400), an issue conversation (400) and a missing file (404). 177 tests pass and typecheck is clean.
- **End-to-end:** I uploaded all 5 PDFs to the dev API through curl. Every lease split into the expected clauses, the file served back as `application/pdf`, and an unknown unit or a .txt got a 400.
- **Follow-up (owner request): formats, multi-page, AI headings.**
  - Images: PNG/JPEG go to the model (`lease-transcription`, prompt in `services/agents/prompts/leaseTranscription.md`) and come back as text, which is then split as usual. The document stores `textSource: 'text' | 'image'`. The stub returns `data/sample-leases/<name>.txt`.
  - Headings: `splitClauses.ts` is now `toLines` / `findHeadings` / `buildClauses` / `paragraphClauses`.
    - When the rules find no numbered heading, `detectHeadings.ts` asks the model (`lease-clause-headings`) only for `{line, id}` pairs.
    - Code validates them: in range, non-empty, ascending, unique IDs, at most 200. It cuts the text itself, keeping an inline heading line in the clause text so first-sentence quotes are kept.
    - Invalid output or a model failure → keep the rules split or use paragraphs. `clauseSplit: 'headings' | 'ai' | 'paragraphs'` is stored for the phase 2/4 flag and the owner check.
  - Storage: `text_source` and `clause_split` columns, added to `002_documents` itself because it was never committed. Migrations moved to `apps/api/src/migrations/`. Relative imports now use `.ts`.
  - Samples:
    - lease-06: 4 pages; clauses 11 and 19 span pages; deposit on p2, signatures on p4.
    - lease-07: DOCX. R6 PASS with the reason "Rent is stated annually (QAR 132,000); no monthly figure to reconcile".
    - lease-08: PNG, rendered with the Geist font. There are no system fonts here and pdfkit's Helvetica isn't embedded, so the first render came out blank. The generator now fails if the image is blank.
    - lease-09: inline headings.
    - PDFs have a fixed CreationDate, so regenerating them is byte-stable.
    - New dev-only deps: `docx`, `@napi-rs/canvas`, `geist`.
  - Tests: 198 pass and typecheck is clean.
  - End-to-end on the dev API with the **real model (mimo)**:
    - lease-06 → 26 clauses, `11@2-3`, `19@3-4`.
    - lease-07 DOCX → correct ids, pages null.
    - lease-08 PNG → transcribed in 18s (2.1k/1.2k tokens); all 20 fixture quotes verified against the real transcript.
    - lease-09 → `split=ai` in 1.7s; clauses `1`–`6`, each keeping its inline first sentence.
- **Known limits:**
  - Scanned PDFs (no text layer) are still rejected. Next step: render pages with unpdf + @napi-rs/canvas and use the image path. That needs canvas as a runtime dependency.
  - One image = one page; multi-image leases are not supported yet.
  - lease-09 with the AI split has no `parties`/`premises` clauses (they're prose in the preamble), so extraction cites `preamble`.
  - The DOCX sample isn't byte-stable on regeneration (`docx` writes timestamps).
  - The file is written before the DB insert, so a failed insert leaves an orphan file.

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
