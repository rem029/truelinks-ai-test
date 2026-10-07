# TrueLinks Lease & Issue Agents

A small full-stack service where AI agents turn a lease document into a structured, verifiable lease record, validate it against an owner's rules, and turn property photos into draft work orders — all linked to the unit.

This is the first slice of what would become a **property management system**. The build covers the brief's requirements; the bigger system is designed and described under [Roadmap](#roadmap-toward-a-property-management-system).

> Work in progress.

## Run it

Requires Node 24+.

```bash
cp .env.example .env      # optional: add OPENROUTER_API_KEY; without it a stub model is used
npm install
npm run dev               # API on :8083, web on :3000 → open http://localhost:3000
npm test                  # end-to-end tests (Playwright; first run: npx playwright install chromium)
npm run typecheck
npm run db:seed           # optional: migrations + seed without starting the API
```

A fresh clone needs no Python or C++ toolchain: `.npmrc` sets `ignore-scripts=true`, because every native dependency ships prebuilt binaries and npm otherwise tries to compile `better-sqlite3` from source when it installs from the lockfile. This was checked by cloning the repo, then running `npm ci` (npm 10 and 11), typecheck, the tests and the full lease and issue flow on the stub provider with no `.env`.

The API creates `var/app.db` on first start, runs migrations and seeds the units and owner ruleset from `data/`, then the current leases of the occupied units (see [Sample data](#sample-data)). Seeding is safe to repeat: it only inserts what's missing (a unit that already has a confirmed lease is skipped), so it never resets a unit's occupancy. Delete `var/app.db` to start from scratch. `GET /api/units` lists the seeded units, and `GET /api/units/:unitId/leases` returns the unit's confirmed lease in effect today (`active`) and the one lined up after it (`next`), each with tenant, dates, monthly rent and deposit. `GET /api/health` reports which model provider is active (`stub` or `openrouter`).

A lease review starts with `POST /api/conversations` (`{kind: "lease", unitId?}`; `unitId` is set when the upload starts from a unit page). `POST /api/conversations/:id/lease-document` takes the file (multipart field `file`: PDF, DOCX, PNG or JPEG, up to 10 MB). It splits the file into clauses, extracts the fields and returns the document, the user message, the draft lease (record, flags and rule results) and the agent's first reply (`messages`), whose cards list what needs attention. The lease has `analysisStatus: pending` while a background pass looks for conflicts and vague terms, and `done` or `failed` after it. A conversation holds one lease, so a second upload gets 409. If extraction fails, the response is 502 and the document stays saved. The owner then reviews with `POST /api/conversations/:id/actions` (a card action: `{type: "accept" | "reject" | "edit" | "choose", cardId, value?/option?}`, `{type: "acceptAll"}`, or `{type: "confirm", conversationId, overrideReason?}`) and `POST /api/conversations/:id/messages` (`{text}`, a typed correction or question for the agent). Both return the updated lease and the new user and assistant messages. `GET /api/conversations/:id` returns the conversation, its messages, documents and lease, and `GET /api/documents/:id/file` serves the original file. Uploaded files are kept in `var/uploads/` (`UPLOAD_DIR`), named by document ID, never by the uploaded filename.

In the web app (http://localhost:3000), everything is filed by unit. A left sidebar holds "New lease review", "Report an issue", the units list (with occupancy) and "Unassigned leases" for reviews whose unit isn't chosen yet; on phones it folds behind a Menu button. A unit (`#/u/<unitId>/issues` or `/leases`) has two tabs: **Issues** (each report with its work order title, severity, urgency and status) and **Lease records** (each review with its file, status and open items). The data comes from `GET /api/units` and `GET /api/conversations`, grouped by unit in the browser. Threads open beside the sidebar, and their back link returns to the unit. "New lease review" opens a thread at `#/c/<conversationId>`: upload a lease, then work through the cards (accept, reject, edit, choose a unit, acknowledge or dismiss a flag, or Accept all), type corrections or questions to the agent, and confirm. While the background analysis runs, the thread shows "Full review running…" and adds the agent's follow-up when it finishes. Each agent reply can expand to show its tool calls, model, tokens and time. `GET /api/conversations/:id` also returns `review.pending` and `review.highSeverityFailures`, which drive the confirm bar. The latest summary card expands into the full field list (with inline Edit), every rule result and every open flag; "Accept all (N)" is disabled when there's nothing left to accept. A switch under the sidebar header toggles light and dark mode; until it's used, the app follows the system setting. Text and controls meet WCAG AA contrast in both themes, every action is a real button or link with a visible focus ring, and the pulsing "working" dot stops for people who ask for reduced motion.

Lease reviews and issue reports can be **archived**: Archive sits on the right of every row in the unit's tabs and Unassigned, and in the thread header (`POST /api/conversations/:id/archive`). Every action first asks in a confirmation modal that names the file or work order, then confirms with a short status message, and focus moves to the page heading since the row is gone. An issue report can be archived any time; a lease draft too, but a confirmed lease only once it has ended, so the unit's current and next lease can't be archived: the list and thread don't offer Archive for them (`archiveBlockedReason` on each summary and thread), and the API refuses with 409 if asked anyway. An archived item is read-only, leaves the lists and the sidebar count, and sits under the **Archived** filter in its tab ("Show archived" on the Unassigned page); **Unarchive** (`POST /api/conversations/:id/unarchive`) brings it back as it was. Only an archived item can be **deleted** (`DELETE /api/conversations/:id`): its rows (conversation, messages, and the lease and documents, or the issue and work order) go in one transaction, and the uploaded file or photos are removed after it commits. A lease that a work order was judged against can't be deleted (409), so the repair decision stays explainable.

**Settings** (bottom of the sidebar) opens a dialog with two tabs. **Rules** lists the current ruleset and its version, and adds a rule in one of two ways. A *field comparison* (e.g. "Monthly Rent ≤ 9,000", "Security Deposit ≥ 2 × Monthly Rent", "Tenant Signed = yes") is checked by code like R1–R7. A *plain-language* rule (e.g. "The lease must forbid subletting without written consent") is judged by the model in the background review: it returns PASS, FAIL or NOT_DETERMINABLE with the clause it relied on, code checks the quote, and a PASS without a matching quote drops to NOT_DETERMINABLE; these results are labelled "checked by AI". Rules can also be edited (built-in R1–R7 only change severity, since their logic is code) and deleted, with an in-dialog confirmation. Every add, edit, delete or restore saves a new ruleset version with a note ("Added R8", "Edited R8", "Deleted R9", "Restored version 1.3"); history is never rewritten, and a deleted rule id is never reused. A version picker shows any earlier version read-only, and "Restore this version" copies it forward as the newest one. Every lease records the version it was checked against. API: `GET /api/rulesets` (history), `GET /api/rulesets/current`, `POST /api/rulesets/current/rules`, `PATCH`/`DELETE /api/rulesets/current/rules/:ruleId`, `POST /api/rulesets/:version/restore`. **Units** lists the units and adds one to an existing building (`POST /api/units`); a new unit starts available.

An issue report starts with `POST /api/conversations` (`{kind: "issue", unitId}`), then `POST /api/conversations/:id/issue-report` (multipart: `reporterRole` `tenant` or `inspector`, optional `note`, and 1–6 `photos` as JPEG, PNG or WebP up to 10 MB each). Each photo is assessed separately and returns a condition (`new`, `good`, `worn`, `damaged` or `undeterminable`), the damage and equipment visible, and a short note. The reply carries a condition card. If photo analysis fails, the response is 502 and nothing is saved. `GET /api/conversations/:id/photos/:photoId` serves a photo; photos are stored in `var/uploads/issues/<issueId>/`, named by ID, never by the uploaded filename.

Then code decides whether a work order is needed: if no photo shows damage, the reply says so and nothing is drafted; if nothing can be judged, it asks for a clearer photo, and more photos can be added to the same report (another `issue-report` call) until a work order is drafted. Otherwise the work order agent runs: it reads the unit's confirmed lease (`get_unit_lease`; the thread's tool log keeps only the lease id, tenant and clause count, not the lease text), drafts one work order (`draft_work_order`: title, one line per fault, category, severity, urgent, responsibility `landlord`/`tenant`/`split`/`unknown` with a reason and a quoted clause), or asks a question (`ask_user`). Code rejects a quote that isn't in the clause, and only allows `unknown` when the unit has no confirmed lease. The owner accepts, rejects or edits the card (`POST /api/conversations/:id/actions` with `cardId: "workOrder"`), or types a correction (`POST /api/conversations/:id/messages`), which re-drafts the same work order. Accepting saves it against the unit and the lease it was drafted from, and closes the conversation. If drafting fails, the report stays saved and the response is 502; sending a message retries. In the web app, "Report an issue" opens a unit picker (already set to the unit you came from), then the report form.

The web app calls the API through Vite's `/api` proxy, so only port 3000 needs to be reachable. To open it through another hostname (e.g. a remote dev box), list it in `WEB_ALLOWED_HOSTS`.

## Repository layout

```
apps/api/src
  routes/       HTTP endpoints: parse and validate the request, call a service, send the response
  db/           Kysely setup, schema types, repositories, seed
  services/     Business logic (lease review, rules, unit matching, work orders)
    agents/     Lease and issue agents, their prompt files, model provider (OpenRouter + stub)
  migrations/   Database migrations, numbered and run in order on start
  middleware/   Express middleware (request log, error handler)
  utils/        Small pure helper functions
apps/web/src
  pages/        One component per screen (unit page, review conversation, …)
  components/   Reusable React components (cards, buttons, …)
  hooks/        Custom hooks, when needed
  store/        Global state (Zustand), when needed
  utils/        Helpers, including the typed API client (utils/api.ts)
  styles/       Plain CSS split by area: tokens (light + dark), base, shell, thread, cards, issue
packages/shared Shared types and Zod schemas (API, agent output, UI)
data/           Owner ruleset, units, sample leases and photos
scripts/        Dev utilities (sample data generation)
e2e/            Playwright end-to-end tests, one spec per user flow
```

Folders are created when their first file is needed. Routes stay thin: no business logic in a route, and no HTTP objects (`req`/`res`) inside a service, so services stay easy to test and reuse. End-to-end tests live in `e2e/`.

## Sample data

- `data/owner_ruleset.json`, `data/units.json` — provided with the brief.
- `data/sample-leases/` — generated test leases (PDF, DOCX and an image), each designed to exercise specific rules or input formats. Regenerate with `npm run samples:leases` (output is byte-stable except the DOCX, which the `docx` library timestamps).

| File | Unit | Exercises |
|---|---|---|
| `lease-01-clean-MC-B-1204.pdf` | MC-B-1204 (available) | Happy path — all rules PASS |
| `lease-02-problems-MC-B-0902.pdf` | MC-B-0902 | R1, R2, R4, R5, R6 FAIL; no unit ID, so the owner confirms the unit (MC-B-0902 suggested) and R7 waits on that |
| `lease-03-occupied-MC-B-1205.pdf` | MC-B-1205 (occupied) | R3 (48-month term) FAIL; R7 FAIL: overlaps the current lease (to 30 June 2027), and confirming is refused |
| `lease-04-quarterly-no-deposit-MC-A-0301.pdf` | MC-A-0301 | Quarterly rent normalisation; no deposit → R1 NOT_DETERMINABLE |
| `lease-05-unknown-unit-rent-conflict.pdf` | Tower C (not in records) | R7 FAIL; conflicting monthly rent (8,500 vs 8,000) must be flagged, not silently resolved |
| `lease-06-long-MC-B-1204.pdf` | MC-B-1204 | 4 pages, 22 clauses; clauses 11 and 19 run across a page break; 36-month term (R3 boundary). All rules PASS |
| `lease-07-docx-MC-A-0302.docx` | MC-A-0302 (occupied) | DOCX input (no page numbers); rent stated annually only; R7 PASS as the next lease (starts the day after the current lease ends) |
| `lease-08-image-MC-A-0301.png` | MC-A-0301 | Image input: the model transcribes it (`.txt` next to it is the transcript the stub returns). All rules PASS |
| `lease-09-inline-headings.pdf` | MC-B-1204 | Headings inline with the text ("1. Term. The term…") and parties in prose: the rules find no headings, so the AI marks them. Not in `expected.json` (format test only) |

`data/sample-leases/expected.json` holds the expected rule outcomes and flags per lease, before the owner has reviewed anything (for example, lease 02's R7 is NOT_DETERMINABLE until the owner confirms the unit). `unitId` is the correct unit. Used by tests and the stub model provider.

- `data/current-leases/` — the leases in effect on the two occupied units (`current-lease-<unitId>.pdf`, generated by the same script): MC-A-0302, Elena Petrova, 1 March 2025 to 28 February 2027; MC-B-1205, Thomas Reyes, 1 July 2025 to 30 June 2027. On start, the API puts each through the same pipeline as an upload (clauses, extraction, quote checks, rules) on the stub model, accepts it and confirms it with the override "Existing tenancy imported from the owner's records" (R7 fails for it: the unit is occupied with no lease on record yet). So an occupied unit is backed by a lease record that opens like any review, and new leases are checked against it by date. The dates are fixed, so after February 2027 the MC-A-0302 lease has ended and the unit page no longer shows it as current.
- `data/sample-photos/` — AI-generated issue photos (none were provided with the brief; prompts in `PROMPTS.md`). `expected.json` was written from what each photo actually shows, not from the prompts.

| Scenario | Unit | Exercises |
|---|---|---|
| `issue-01-ac-leak` | MC-B-1204 | Split AC leaking, wall stain, puddle → HVAC work order; landlord responsible (lease 01 §7) |
| `issue-02-tap-drip` | MC-B-0902 | Two faults: dripping tap + corroded drain. Responsibility is split (lease 02 §7: tenant pays minor repairs under QAR 500), so the agent should surface it, not decide |
| `issue-03-water-heater` | MC-A-0301 | Corroded, leaking water heater with exposed wiring and a wet socket → high severity, urgent safety advice |
| `issue-04-move-in-ok` | MC-B-1204 | New, undamaged rooms → equipment inventory, "no issue found", no work order (no false positives) |
| `issue-05-unclear` | MC-A-0301 | Dark, blurry photo → agent asks for a clearer one instead of guessing |

## How it works

**Two flows, joined by the unit.** They happen at different times: a lease at signing, an issue at any point during the tenancy.

- **Lease (owner):** upload a PDF or DOCX → split into clauses → AI extracts each field with its clause and quote → code checks the quotes, matches the unit and runs rules R1–R7 → the agent asks about what needs attention → the owner accepts, rejects, edits or types corrections, then confirms → the lease is on the unit's timeline: if it is in effect today the unit is marked occupied, if it starts later it is the unit's next lease.
- **Issue (tenant or inspector):** photos and a note for a unit → AI assesses condition, damage and equipment → reads the unit's lease to see who is responsible for the repair → drafts a work order → a person accepts, rejects or edits it.
- **Unit page:** the current lease and the next one (tenant, term with months left, rent, deposit, a link to the full record with sources and rule results) and the unit's issues and work orders, in one place. Each tab has **status filters**: chips with counts (Lease records: Active, Next, Later, Draft, Ended, Archived; Issues: Needs review, Accepted, Rejected, No work order, Archived, plus an Urgent toggle). A chip with nothing in it is hidden, pressing the selected chip clears it, and a filtered list says how many it shows ("Showing 1 of 2 issues"). The filter is in the URL (`#/u/MC-B-1234/leases?status=draft`, `?urgent=1`), so Back and shared links keep it; the default shows everything except archived. It filters the summaries already loaded in the browser; each lease summary carries `leaseTiming` (`active`, `next`, `later` or `ended`, worked out on the server from the unit's confirmed leases) for that.

## Scope

**Built:** everything the brief asks for — lease extraction with sources, flags, rule validation, unit matching and occupancy update, photo assessment and draft work orders, accept/reject/edit on every field, flag and work order, and the unit page. Runs with a stub model (no key) or a real one through OpenRouter.

**Left out on purpose** (to deliver the brief in four days): login and roles, tenant QR reporting, ticket statuses and follow-ups, notifications, editing or removing units, occupancy that follows lease dates, scanned PDFs and multi-image leases, streaming responses. All are designed below in the [Roadmap](#roadmap-toward-a-property-management-system).

## Decisions

- **Review happens in a chat, and the result is saved to the unit.** The user uploads a lease or photos into a conversation. The agent replies with interactive cards (fields with their source quote, flags, rule results, a draft work order). The user accepts, rejects or edits a card, or types a correction in plain language. The agent updates only the affected fields, runs the rules again, says what changed and asks about whatever is still open. This repeats until the user confirms. The confirmed result is saved to the unit, and the unit page links back to the conversation.
- **A correction changes only the fields it mentions; the agent never re-reads the whole lease.** Accepted fields are locked. Re-reading the lease on every turn could quietly change values the user already approved, because model output varies from run to run. A typed correction is recorded with the user's message as its source, so the record stays traceable.
- **The model extracts and code decides.** Rules R1–R7, date calculations, unit matching and quote checks are plain TypeScript functions with no I/O. Rules are loaded from `data/owner_ruleset.json`, and every lease review records the ruleset version it was checked against.
- **Tool calling where the agent has to decide; fixed steps elsewhere.** The first extraction is a single structured-output call. In the review loop and the issue flow, the agent chooses among tools: `search_clauses`, `update_field`, `find_unit`, `evaluate_rules`, `get_unit_lease`, `draft_work_order`, `ask_user`. There is no tool for confirming, saving or changing occupancy; only the user's button does that. Tool arguments are schema-checked, each turn is capped at about 6 steps, and every call is logged.
- **One work order per report, responsibility is advice.** A report with two faults (issue-02: a dripping tap and a corroded drain) becomes one work order with a line per fault, not two. Responsibility is `split` when faults fall to different parties or depend on a cost the photos can't show ("minor repairs under QAR 500"), and the reason says which fault goes where. The agent must quote the lease clause, and code checks the quote. If the owner changes the party, the quote is dropped, because it no longer supports the choice. Code, not the model, decides whether to draft at all: no damage means no work order, so the agent can't invent one.
- **No second "judge" AI.** Code checks and human review already cover verification more reliably, at no extra cost or delay. The useful cross-checking (for example, who pays for a repair) happens through `get_unit_lease`.
- **PDF, DOCX and images.** PDF and DOCX are read as text. A PNG or JPEG photo of a lease is transcribed by the vision model, then split like any other text, and the document is marked `textSource: image`: its quotes can only be checked against the model's own transcription, so the owner is told so. Scanned PDFs (pages with no text layer) are still rejected with a clear message; rendering their pages to images for the same path is on the roadmap.
- **Occupancy changes only when the user confirms.** If a high-severity rule fails, confirming needs an override reason.
- **Archiving is a flag, not a status.** `conversations.archived_at` is separate from the review's status, so unarchiving restores a draft as a draft and a confirmed lease as confirmed, and an archived ended lease still counts when a new lease's dates are checked for overlap. Delete is permanent, so it needs archiving first and an explicit confirmation. Issue reports can be archived at any stage, since there is no "done" work order status yet to wait for.
- **Code splits the lease into clauses; the model doesn't.** PDFs are read page by page with `unpdf` and DOCX files with `mammoth`. Headings are found by simple rules: a numbered line (`1. Term`) counts only if it is the next number in sequence, so a wrapped line such as "1 November 2026" isn't mistaken for a clause; a short all-caps line (`PARTIES`, `PREMISES`, `SIGNATURES`) is a section; text before the first heading is the `preamble`. When the rules find no numbered heading (for example headings written inline, "1. Term. The term is…"), the model is asked which lines are headings. It only returns line numbers and IDs; code checks them (lines exist, in order, IDs unique) and cuts the text itself, so every clause is still the document's own words and quotes stay checkable. If the model finds nothing, fails or isn't available (stub), the document falls back to one clause per paragraph (`p1`, `p2`, …). Every document records how it was split (`clauseSplit`: `headings`, `ai` or `paragraphs`) so the owner is asked to check an AI or paragraph split. Each clause stores its ID, heading, text and the pages it starts and ends on, so a citation can open the original PDF at the right page. DOCX has no reliable page numbers, so its clauses have none. Clause IDs are what every extracted field cites, and a quote is checked against the text of the clause it names. All the sample leases (PDF, multi-page PDF, DOCX, image) split into the expected clauses, and every quote in the test fixtures is found in the clause it cites, including against a real model's transcription of the image lease.
- **Extraction runs in two passes: a fast one while the owner waits, a thorough one in the background.** Both get the clauses as `[clauseId] heading` plus text, and code checks every answer.
  - **Pass 1, during the upload: fields only, on the fast model** (`modelTier: fast`, prompt `leaseExtraction.md`). Uploads now return in 4–6.5 s, image transcription included (10–21 s on mimo with low reasoning, 20–50 s at first). Copying fields out needs little judgement, and every quote is checked anyway.
    - For each field the model returns `found`, the value, the clause it came from, a verbatim quote and a confidence. When the lease doesn't state a field, `found` is false and the field is stored as empty, never guessed.
    - Each field has a single type with no nullable or union types, because mimo fails on those (see below).
    - Code checks each quote against the clause it cites. The check ignores whitespace, quote style, dash style and case, but every word must match. A quote that isn't found keeps its value and gets an "unverified quote" flag.
    - A value that doesn't fit its type (for example a date that isn't a date) is stored as empty and flagged.
    - The draft lease is saved with its rule results and `analysisStatus: pending`, and the upload responds. The owner can start reviewing.
  - **Pass 2, in the background: the whole document on the default model with full reasoning** (prompt `leaseAnalysis.md`). This pass looks only for what needs judgement, and its flags are added to the lease when it finishes (`analysisStatus: done`; about 10–15 s after the upload returns).
    - **Conflicts:** when clauses disagree (lease 05: 8,500 in the rent clause, 8,000 in the payment schedule), it lists every candidate with its quote. Code drops any candidate whose quote isn't in the lease and reports the disagreement once as a high-severity flag ("Monthly rent conflict: clause 2 says 8,500, clause 5 says 8,000").
    - **Concerns** code can't check, such as "Renewal terms vague". The prompt defines vague (no renewal length, notice period or rent basis) and lists what code already checks, so these flags don't repeat code's.
    - It re-reads the lease before saving, so changes the owner made in the meantime are kept.
    - If it fails, the lease records `analysisStatus: failed` and a flag tells the owner that conflicts and vague terms weren't checked. A failure here never fails the upload.
    - **Trade-off:** it runs inside the API process, so a restart while it's running leaves the lease `pending`. At scale this belongs on a job queue with retries (see "Where it breaks first at scale").
- **The review loop shows only what needs a decision.** The agent's first reply is a summary card (fields found, rule results, open flags, "N fields look fine" with an "Accept all (N)" button), then cards for the unit match, each open flag, each failing or undeterminable rule, and the flagged fields. Everything else is collapsed behind one "Accept all", which never accepts a field an open flag points at. After every card action or typed message, code reruns the flags and rules and the reply says what changed ("rent.monthly: 8,000 → 8,500", "R7: NOT_DETERMINABLE → PASS", "Flag resolved: …") and how many items are still open.
  - **Card actions are plain code, no model.** Accept, reject (the value is cleared and the original kept), edit (validated and converted to the field's type, so "QAR 8,500" becomes 8500), choose a unit, acknowledge or dismiss a flag. Every action is saved as a user message first, and an edited value cites that message as its source. An invalid action is rejected before anything is saved.
  - **Typed messages go to the agent** (`leaseCorrection.md`, default model, at most 6 steps) with five tools: `search_clauses`, `update_field`, `find_unit`, `evaluate_rules` and `ask_user`. It gets the current fields and their review state, the open items and the last 10 messages. Each assistant message stores its tool calls, model, tokens and time (`agentRun`), so the UI can show the steps.
  - **Locked means locked.** A field the owner accepted or edited can't be changed by the agent. `update_field` refuses it and the agent tells the owner to use Edit on the card. Only the owner's own card action changes it.
  - **When unsure, the agent asks.** With the real model, "the rent looks wrong" made it read the rent clauses and ask "8,500 or 8,000?" instead of picking one. A unit it can't find after two searches is also a question, not a guess. Tool arguments are plain strings, because mimo garbles union types; code converts each value to its field's type.
  - **Confirm is a button, never a tool.** Confirming is refused (409, with the list) while anything is open: the background analysis is still running, the unit isn't confirmed, a flag is open, or a field hasn't been reviewed. A high-severity rule failure needs an override reason, which is stored on the lease. A lease whose dates overlap a confirmed lease on the same unit is refused outright, override or not (409): only one lease can be in effect. Confirming marks the lease confirmed and the conversation closed, and the unit occupied if the lease is in effect today, in one database transaction, so a failure can't leave the unit occupied without a confirmed lease. A lease that starts later leaves the unit as it is (nothing yet flips a unit to occupied on the day its next lease starts, or back to available when its last lease ends; see Roadmap item 10). After that, every action gets 409.
- **Amounts are only accepted in QAR.** If the lease states amounts with no currency, or in another currency, a high-severity flag asks the owner to confirm. Nothing is ever converted.
- **No fixed lease template.** The agent reads whatever lease is uploaded. Leases come from many sources (old leases, broker drafts, other templates), so the AI does the reading and a person corrects it. Every extracted field can be accepted, rejected or edited, and the rules run again on the corrected values.
- **SQLite now, with the database kept swappable.** SQLite needs no server: `npm install` and it runs, which matters for reviewers starting the project. To keep the database replaceable:
  - The app's logic talks to *repository interfaces* (`UnitRepository`, `LeaseRepository`, …), never to a database driver.
  - The repositories use [Kysely](https://kysely.dev), a typed SQL query builder that supports SQLite, Postgres and MySQL. Switching databases means changing the dialect in one file and setting `DATABASE_URL`, not rewriting queries.
  - Migrations stick to portable SQL types. Structured records (a lease's extracted fields, chat cards) go in JSON columns: `TEXT` in SQLite, `jsonb` in Postgres. Every JSON column is parsed with the shared Zod schema when it's read, so a bad row fails loudly instead of reaching the UI.
  - Migrations are TypeScript objects registered in one list (no file scanning), so they run the same under `tsx` and a build.
  - **Why Kysely over Drizzle or Prisma.** All three are typed and support these databases. Kysely is only a query builder: queries read like SQL, with no models, relation layer or code generator, which matches "plain functions and data" when the repositories already hide data access from the services. Prisma adds its own schema language and a generated client; Drizzle is the closest alternative. The trade-off: Drizzle generates migrations from one TypeScript schema, while here `db/schema.ts` (the table types) is kept in step with the migrations by hand, so a new column means touching both. At this size that's a small cost. Since services only see the repository interfaces, switching later would mean rewriting the repositories and migrations, not the app.
  - A `postgres://` URL currently stops with a clear "not wired yet" error rather than adding a Postgres driver nobody uses yet.
  - **Trade-off:** SQLite allows only one writer at a time, so it's the first thing to replace when there are many users. That's the first item under "Where it breaks first at scale".
- **Few dependencies, all actively maintained and widely used.** Every package must have a recent release, strong weekly downloads and TypeScript types. For example, PDFs are read with `unpdf` (built on Mozilla's pdf.js, released in the last few months), not the better-known `pdf-parse`, whose last release is almost a year old. Sample leases are generated with dev-only tools: `pdfkit` (PDF), `docx` (DOCX), and `@napi-rs/canvas` to render the image lease, with the Geist font files kept in `scripts/fonts/` (OFL licence alongside). The machine has no system fonts and PDF's built-in Helvetica isn't embedded, so without a real font file the image comes out blank. The `geist` npm package was dropped because it pulls in Next.js as a peer dependency. None of these ship with the app.
- **The browser talks to the API through the Vite dev proxy.** The web app calls `/api/...` on its own origin and Vite forwards it to the API. That means no CORS setup and no API URL to configure, and it behaves the same on localhost and behind a remote proxy. In production the same path would be routed by the reverse proxy.
- **Imports name the real file.** Relative imports use `.ts` (`./rules.ts`), not the `.js` that Node's ESM convention asks for when TypeScript compiles to JavaScript. Nothing here is compiled: `tsx` runs the API, Vite builds the web app and `tsc` only typechecks, so `.ts` points at the file that actually exists and also works with Node's built-in TypeScript support.
- **Standard library over small packages.** `.env` is loaded with Node's built-in `process.loadEnvFile` (no `dotenv`) and validated with Zod at startup, so a bad value fails loudly. The shared package is consumed as TypeScript source (no build step) by `tsx` in the API and Vite in the web app.
- **End-to-end tests instead of unit tests.** `npm test` runs Playwright against the real app: it starts its own API and web server on ports 8093 and 3010 with an in-memory SQLite database (`DATABASE_URL=file::memory:`) and the stub model. Every run starts with only the seed data: units, ruleset and the two current leases (the first spec checks exactly that), and it runs next to `npm run dev` without touching `var/app.db`. Each test is recorded on video; `npx playwright show-report` opens the HTML report with the videos, and a failing test also keeps a screenshot and a trace. The flows covered: upload a lease, Accept all, confirm and find it under its unit; report an issue with photos, accept the drafted work order and find it under its unit; Settings (rules and units); and unit leases (the seeded current lease on the unit page, lease 07 passing R7 as the next lease, lease 03 failing R7 by overlap and being refused at confirm); and archiving (a draft lease archived and deleted from its row through the confirmation modal, the current lease refused, an issue report archived); and the unit filters (lease records to Draft and Back to All; issues to Accepted, the Urgent toggle, an empty filter and Show all). They check what a reviewer would click through, including that every control is reachable by its accessible name (a hidden radio button failed this and was fixed). The trade-off: the rules, date math and quote checks are no longer tested one function at a time, so a regression there shows up only if it breaks a flow.
- **Owner rules: code checks what it can, the model only what needs reading.** A rule that compares a lease field with a number or another field is evaluated by code, so it is exact and explainable. Rules that need reading the lease ("no subletting without consent") can't be expressed that way, so the model judges them, but only with a quote that code verifies; the UI labels those results "checked by AI" so the owner knows who decided. Rules are never edited in place: each change is a new ruleset version.
- **Dependency install scripts are off (`.npmrc`: `ignore-scripts=true`).** `better-sqlite3` ships prebuilt binaries and marks itself `gypfile: false`, but npm loses that flag when it installs from the lockfile and tries `node-gyp rebuild`, which fails without Python. Nothing else here needs an install script (esbuild gets its binary through optional dependencies), so turning scripts off makes a fresh clone install everywhere and stops dependencies from running code at install time. Our own `npm run` scripts are unaffected.
- **Zustand for global UI state, only where it's needed.** We have used it before; it's small, hook-based and needs no provider or boilerplate. Local component state stays in `useState`, and server data comes from the API client. A store is added only for state shared across screens (e.g. the open conversation).
- **React Router for navigation.** The app first had a hand-written hash router (parse and build functions plus a `hashchange` listener), which grew harder to read once the unit page put filters in the query string. React Router is the router most React developers already know, ships its own types and is actively maintained. Routes are declared in one place (`App.tsx`), links are `<Link>`/`<NavLink>` (which set `aria-current` themselves), and the unit filters use `useSearchParams`. `HashRouter` keeps the `#/...` URLs, so links work with any static host and the API stays on its own `/api` prefix. Smaller options (wouter) and typed ones (TanStack Router) were considered; neither is worth the less familiar API for six routes.
- **Two cheap models: a fast one for simple jobs, a reasoning one for judgement.** `OPENROUTER_FAST_MODEL` (`google/gemini-3.5-flash-lite`) handles lease extraction, heading detection and image transcription. `OPENROUTER_MODEL` (`xiaomi/mimo-v2.6-pro`) handles the background analysis, the review chat's tool calls and photo assessment. Chat turns (lease corrections, work order drafts) run with low reasoning effort: they patch a few fields, and with full reasoning a reply took 30–100 s. Each model call states which tier it needs (`modelTier`).
- **Photos are assessed one at a time, by the careful model, with the fast one as a backup.** Each photo is a separate call, run in parallel, so every finding belongs to one photo. The prompt (`photoAnalysis.md`) defines each condition, asks for safety hazards such as exposed wiring to be listed as damage, and forbids naming brands, because text on an appliance in a photo can't be trusted. With the real models, mimo judged all nine sample photos correctly, including asking for a clearer version of the dark one, but returned empty content for 2–3 of them, even on retry. Flash Lite never failed but called the dark photo "damaged, mold". So mimo goes first and Flash Lite answers only for a photo mimo couldn't; the log line names the model used. The reply text ("Looked at 2 photos: 1 damaged, 1 worn. Seen: …", "No damage seen.", or a request for a clearer photo) is written by code from the results, not by the model.
  - **How the fast model was chosen:** 8 cheap models were measured on the same extraction, checking the extracted values against the fixtures and the quotes against the clauses, not just speed. Gemini Flash Lite took 4–5 s every time with no wrong values. mimo took 11–16 s, and once hung for 90 s. DeepSeek v4.1 Flash varied from 3 to 16 s depending on the host. Others were slower, or got the rent or a signature wrong, or returned invalid JSON. On the image lease, Gemini transcribed in about 3 s against mimo's 17 s, and all 20 fixture quotes were found in its transcript.
  - **Cost:** Gemini's output costs more per token ($2.50 vs $0.87 per million), but an extraction is about $0.005 per lease. Swapping either model is a config change.
  - Both models take images, call tools and return JSON, at a small fraction of a frontier model's price.
- **One set of schemas for API, agent and UI.** `packages/shared` defines every domain type with Zod (lease record, sourced field, flag, rule result, issue, work order, conversation, message, card, action). Each extracted field carries its value, its source (a clause and quote, or the user message that changed it), a confidence and a review state. A card's allowed actions come from one map (`ALLOWED_ACTIONS`), so the UI and the API can't disagree about what a card supports.
- **One model interface, and a stub that runs without a key.** Agents call a single `complete()` function for structured output, tool calls and images. Without `OPENROUTER_API_KEY` the app uses a stub model. It returns photo assessments from `data/sample-photos/expected.json`. It returns lease extractions from the sample fixtures, picked by the uploaded filename, so an unknown lease comes back with nothing found and every field goes to the owner. It also handles plain-English corrections with a small parser (for example "rent is 8500" becomes an `update_field` call, while "change it" makes it ask a question), so reviewers can run the whole app without a key or network. With a key, the same interface goes to OpenRouter through the `openai` SDK (OpenRouter is OpenAI-compatible, and the SDK is maintained, typed and very widely used).
  - **Model output is checked like any other input.** Structured output is checked against the Zod schema. If it's invalid, the model gets one retry with the validation error, and after that the call fails with a clear error. An upstream failure (`finish_reason: error`) fails right away. Every model call logs one line with the purpose, model, tokens, time taken and result, never the content or the key.
  - **Tool errors go back to the model, not to the user.** Every tool argument is checked with Zod. A bad argument, an unknown tool or a failing handler is sent back to the model as the tool's result so it can correct itself. A turn ends when the model gives a final reply or calls `ask_user`, or after 6 steps. Every tool call is logged and returned to the caller so it can be stored with the message.
  - **Tool arguments use one type per field.** In testing, `xiaomi/mimo-v2.6-pro` failed upstream whenever a tool argument allowed two types (`string | number`). Tool schemas therefore give each field a single type.
- **Term length counts the expiry date as inclusive.** A lease from 1 Nov 2026 to 31 Oct 2028 is 24 months. Rule R4 uses this convention. A span that isn't a whole number of months (for example a lease starting on 31 January) fails R4 so a person looks at it, rather than being rounded.
- **Rules give one of three results: PASS, FAIL or NOT_DETERMINABLE.** Each rule is a small function in `apps/api/src/services/leases/rules.ts`. The ruleset (which rules run, their severity and version) is read from the database, which is seeded from `data/owner_ruleset.json`. Every result records the ruleset version, the clauses it relied on and a reason with the actual numbers (for example "Deposit QAR 5,000 is less than monthly rent QAR 6,200"). A missing value gives NOT_DETERMINABLE, never a guessed PASS or FAIL. A rule in the ruleset with no matching code also comes back NOT_DETERMINABLE, so the gap shows up in review.
  - **Rent is normalised to monthly.** Quarterly or annual rent is divided down to a monthly amount (and flagged as derived) before R1 and R6 compare it. R6 allows a difference of 1 currency unit for rounding.
  - **Only the unit ID is trusted for an automatic match; otherwise the owner confirms.** Linking a lease to the wrong unit marks the wrong unit occupied, which costs far more than one click. If the lease states a unit ID that is in the owner's records, the unit is matched. If not, the agent asks the owner, suggesting likely units: the unit page the upload started from, units whose label appears in the premises text, and units with the same parking bay. Until the owner chooses, R7 is NOT_DETERMINABLE. If there is nothing to suggest, R7 fails ("not in owner records"). The owner's choice is recorded as the unit ID, with their message as its source. A lease that names a different unit from the page it was uploaded on raises a flag. The unit ID can only ever be one of the owner's units: editing it shows a dropdown, and the API rejects any other value (400 for a card edit; for the agent, a tool error that tells it to look the unit up with `find_unit`).
  - **R7 reads "available" as "no lease in effect for those dates".** The owner's rule says the unit must be marked available before a new lease is linked; taken literally, nobody could sign the next tenant before the current one moves out. So R7 compares dates with the unit's confirmed leases (pure `apps/api/src/services/leases/unitLeases.ts`): an overlap FAILs and names the tenant and term; a lease starting after the current one ends PASSes as the next lease; missing dates give NOT_DETERMINABLE; a unit marked occupied with no lease on record FAILs. No extra column links leases to units: `leases.unit_id`, the status and the term dates are enough, because confirm never lets two confirmed leases on a unit overlap. The work-order agent reads the lease in effect today (not the newest confirmed one, which could be the next tenant's), and the lease agent has a `get_unit_leases` tool for "when does the current tenant leave?".
  - **Flags are for data problems; rules are for policy.** Flags cover:
    - missing fields, contradictions (stated term vs dates, annual vs monthly rent), missing signatures and odd values;
    - a duplicate: same tenant, start date and monthly rent as a lease already confirmed on the unit (`DUPLICATE_LEASE`, high);
    - how the unit was matched;
    - unverified quotes, and a currency that is missing or isn't QAR;
    - text transcribed from an image, and a clause split made by the AI or by paragraph;
    - conflicting values and the model's judgement concerns.

    All but the last two are worked out from the record, so they update when a field is corrected. Conflicts and concerns come only from the background analysis, so they are stored with the lease and kept when the rest are worked out again. One drops away when the owner has accepted or edited every field it names, for example once the owner sets the monthly rent. Policy breaches, such as a term over 36 months or an occupied unit, appear as rule results and are not repeated as flags. The checks are tested against all five sample leases and `data/sample-leases/expected.json`.

## How this was built

Built with AI coding tools, as the brief invites. Planning lives in `docs/tasks/` (one file per task, split into phases with Tasks and Results), and the working rules are in `CLAUDE.md`. Every phase follows the same loop:
1. **Plan:** Claude Code writes a precise brief for the phase.
2. **Implement:** a second coding agent (via agy-bridge) writes the code.
3. **Seed and test:** load the sample data and run typecheck and the end-to-end tests on the stub model.
4. **Review:** Claude Code reviews the full diff against the standards, and the two loop until it's clean.

Splitting writing from reviewing means no agent signs off its own work. The one exception so far: when the second agent ran out of quota partway through task 04 phase 2, Claude Code wrote the rest, and the task's Results say which parts.

## Where it breaks first at scale

1. **SQLite allows one writer at a time.** Many owners reviewing and many tenants reporting at once would queue on writes. Fix: switch the Kysely dialect to Postgres.
2. **Uploaded files live on the API server's disk.** That breaks with more than one API instance and has no backup. Fix: object storage (S3 or similar), keeping the same document ID as the key.
3. **Background lease analysis runs inside the API process.** A restart while it runs leaves the lease `pending` forever, and many uploads at once all call the model together. Fix: a job queue (a `jobs` table to start, then a queue service) with retries and a concurrency limit, and the UI shows queue progress.
4. **The unit page loads every conversation and filters in the browser.** `GET /api/conversations` returns all summaries, built with a few queries per conversation, and the status chips filter them client-side. Fine for hundreds; with thousands it gets slow. Fix: filter and page on the server (`?unitId=&status=&cursor=`), with `leaseTiming` computed in the query, keeping the same URL filters in the UI.

## Roadmap: toward a property management system

Everything below was designed during planning but is **not built**. The brief's requirements came first. Items 1–5 are ready to start next, in this order, and the first ones get built if time allows. The order follows what saves an owner the most time or money soonest.

### Next: make it usable by a real team

**1. Roles, with one-click role shortcuts instead of a login.** Login wasn't part of the brief, and a login form only slows a reviewer down. The first step is a test-only version that shows permissions working:
- One test user per role in `data/users.json` (owner, inspector, and a tenant tied to a unit), with **no passwords**.
- The first screen has three buttons, **Owner**, **Inspector** and **Tenant**, and the sidebar has "Switch role". Picking one returns a random session token kept in the API's memory, so a reviewer sees each role's view in one click.
- **The real part is the role check on every API route.** That's the code we'd keep.
- **Production would instead:**
  - Replace the role buttons with real sign-in: Google or Microsoft, or a managed auth service. If passwords are ever stored, hash them with argon2 or bcrypt.
  - Use secure HTTP-only cookies with expiry.
  - Add rate limits on login, password reset and an audit log.
  - Let an admin assign owners and inspectors, with support for several owners.

  Only the code that identifies the user changes; the permission checks stay as they are.

| Area | Owner | Inspector | Tenant (role shortcut, or the QR link with no account) |
|---|---|---|---|
| Lease records (upload, review, confirm) | ✅ | ❌ | ❌ |
| Reports (list, photos, AI assessment, work order status) | ✅ all units | ✅ all units | Their unit only, public messages |
| Create a report | ✅ pick any unit | ✅ pick any unit | ✅ their own unit only (set by the tenant user or the QR link) |
| Approve work orders, change status | ✅ | ❌ | ❌ |

**2. Tenants report by QR code, with no account.** Reporting has to be effortless:
- Each unit gets a private link that's impossible to guess, printable as a QR code inside the unit.
- **One report form, two ways in:**
  - The public QR page: tenant 1's QR → unit A, tenant 2's QR → unit B, with the unit fixed by the link.
  - The signed-in page, where owners and inspectors pick the unit. An inspector who scans a QR code while signed in gets the report saved under their name.
- **Safeguards:** the link is rate-limited, and it only reaches its own unit's tickets (public messages). The owner revokes it and issues a new one when a tenant moves out.

**3. Reports become tickets.** The reporter fills in a form; the owner does the chat review.
- **Statuses:** Submitted → AI reviewed → Awaiting owner → In progress → Resolved → Closed. Two side branches:
  - **Needs info:** for example, the AI asks for a clearer photo.
  - **Rejected:** with a reason the reporter sees, for example "tenant responsibility per lease".

  Every status change records who made it and when.
- **Public and internal messages:**
  - Public: the reporter and the team. The reporter sees these.
  - Internal: the AI's assessment, lease-based responsibility notes and the owner's review. Lease details never reach tenants.
- **Follow-ups:** reporters see their unit's tickets and can add text or photos. The AI re-assesses each follow-up and the owner is notified.
- **Duplicates:** the AI flags a report that looks like an open ticket on the same unit.

**4. Notifications.** First an in-app inbox with an unread count, then email and **WhatsApp** (the norm in Qatar) for owners, plus status updates for tenants.

**5. More settings.** Rules (add, edit, delete, version history, restore) and adding units are built (see Settings above). Next: edit or retire a unit, switch a rule off without deleting it, and re-check open drafts against a new ruleset version on request. The same screen picks the two AI models (fast and default) from OpenRouter's list, showing each model's price and an estimated cost per lease. Until then they are set in `.env`.

### Then: reduce manual work

**6. Leases in more formats.**
- **Images and scanned PDFs:** transcribed by the vision model and flagged "transcribed from image", because their citations can only be checked against that transcription.
- **Bilingual Arabic/English leases.**
- **More varied test leases:** prose without numbered clauses, dates written out in words, parties in a table.

**7. Move-in inspection.** Photograph the unit when the lease starts to record its condition. At move-out, compare the new photos against that record to support or dispute deposit deductions. This joins the two features in a way owners would pay for.

**8. Learn from corrections.** Log every correction (which field, value before and after, where the lease came from) to measure extraction accuracy per field and source, and find where the agent is weak.

**9. Faster maintenance.**
- Response-time targets by severity.
- Assigning tickets to contractors.
- Recurring-issue analytics: "this unit's AC has leaked three times; replace it, don't repair it."
**10. Occupancy follows the lease dates.** Today a unit becomes occupied only when an in-effect lease is confirmed; a next lease that starts later, or a lease that ends, doesn’t change it. The fix is a pure `unitOccupancy(confirmedLeases, today)` (occupied if a lease is in effect, otherwise available; a unit with no confirmed lease keeps the owner’s status) applied by a `syncOccupancy` job that logs each unit it changes. It runs once on API start and daily as `npm run occupancy:sync` from an external scheduler (cron, a Kubernetes CronJob or a cloud scheduler), not a `setInterval` in the API: the schedule stays visible to operators and runs once however many API instances there are. At scale it would read only the leases starting or ending that day.

### Later: change how leases are made

**11. Fast path for the owner's own template.** Read leases on the owner's standard template with plain code, and send everything else to the AI agent.

**12. Create leases inside the product.** Build the lease from a structured record and produce the PDF from it. There's nothing to extract, and the rules are checked before signing, not after.

**13. Rules in plain language.** The owner writes a rule ("3BR units must include parking"). The AI proposes a structured rule, the owner approves it, and it becomes a new ruleset version.
