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
npm test                  # unit tests
npm run typecheck
npm run db:seed           # optional: migrations + seed without starting the API
```

The API creates `var/app.db` on first start, runs migrations and seeds the units and owner ruleset from `data/`. Seeding is safe to repeat: it only inserts what's missing, so it never resets a unit's occupancy. Delete `var/app.db` to start from scratch. `GET /api/units` lists the seeded units. `GET /api/health` reports which model provider is active (`stub` or `openrouter`).

The web app calls the API through Vite's `/api` proxy, so only port 3000 needs to be reachable. To open it through another hostname (e.g. a remote dev box), list it in `WEB_ALLOWED_HOSTS`.

## Repository layout

```
apps/api/src
  routes/       HTTP endpoints: parse and validate the request, call a service, send the response
  services/     Business logic (lease review, rules, unit matching, work orders)
    db/         Kysely setup, migrations, repositories, seed
    agents/     Lease and issue agents, their prompt files, model provider (OpenRouter + stub)
  middleware/   Express middleware (request log, error handler)
  utils/        Small pure helper functions
apps/web/src
  pages/        One component per screen (unit page, review conversation, …)
  components/   Reusable React components (cards, buttons, …)
  hooks/        Custom hooks, when needed
  store/        Global state (Zustand), when needed
  utils/        Helpers, including the typed API client (utils/api.ts)
packages/shared Shared types and Zod schemas (API, agent output, UI)
data/           Owner ruleset, units, sample leases and photos
scripts/        Dev utilities (sample data generation)
```

Folders are created when their first file is needed. Routes stay thin: no business logic in a route, and no HTTP objects (`req`/`res`) inside a service, so services can be unit-tested directly. Tests sit next to the file they test (`rules.ts` → `rules.test.ts`).

## Sample data

- `data/owner_ruleset.json`, `data/units.json` — provided with the brief.
- `data/sample-leases/` — generated test leases (PDF), each designed to exercise specific rules. Regenerate with `npm run samples:leases`.

| File | Unit | Exercises |
|---|---|---|
| `lease-01-clean-MC-B-1204.pdf` | MC-B-1204 (available) | Happy path — all rules PASS |
| `lease-02-problems-MC-B-0902.pdf` | MC-B-0902 | R1, R2, R4, R5, R6 FAIL; no unit ID, so the owner confirms the unit (MC-B-0902 suggested) and R7 waits on that |
| `lease-03-occupied-MC-B-1205.pdf` | MC-B-1205 (occupied) | R3 (48-month term), R7 (unit occupied) FAIL |
| `lease-04-quarterly-no-deposit-MC-A-0301.pdf` | MC-A-0301 | Quarterly rent normalisation; no deposit → R1 NOT_DETERMINABLE |
| `lease-05-unknown-unit-rent-conflict.pdf` | Tower C (not in records) | R7 FAIL; conflicting monthly rent (8,500 vs 8,000) must be flagged, not silently resolved |

`data/sample-leases/expected.json` holds the expected rule outcomes and flags per lease, before the owner has reviewed anything (for example, lease 02's R7 is NOT_DETERMINABLE until the owner confirms the unit). `unitId` is the correct unit. Used by tests and the stub model provider.

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

- **Lease (owner):** upload a PDF or DOCX → split into clauses → AI extracts each field with its clause and quote → code checks the quotes, matches the unit and runs rules R1–R7 → the agent asks about what needs attention → the owner accepts, rejects, edits or types corrections, then confirms → the lease becomes the unit's active lease and the unit is marked occupied.
- **Issue (tenant or inspector):** photos and a note for a unit → AI assesses condition, damage and equipment → reads the unit's lease to see who is responsible for the repair → drafts a work order → a person accepts, rejects or edits it.
- **Unit page:** the active lease (with sources, review state and rule results) and the unit's issues and work orders, in one place.

## Scope

**Built:** everything the brief asks for — lease extraction with sources, flags, rule validation, unit matching and occupancy update, photo assessment and draft work orders, accept/reject/edit on every field, flag and work order, and the unit page. Runs with a stub model (no key) or a real one through OpenRouter.

**Left out on purpose** (to deliver the brief in four days): login and roles, tenant QR reporting, ticket statuses and follow-ups, notifications, editable settings, image or scanned leases, streaming responses. All are designed below in the [Roadmap](#roadmap-toward-a-property-management-system).

## Decisions

- **Review happens in a chat, and the result is saved to the unit.** The user uploads a lease or photos into a conversation. The agent replies with interactive cards (fields with their source quote, flags, rule results, a draft work order). The user accepts, rejects or edits a card, or types a correction in plain language. The agent updates only the affected fields, runs the rules again, says what changed and asks about whatever is still open. This repeats until the user confirms. The confirmed result is saved to the unit, and the unit page links back to the conversation.
- **A correction changes only the fields it mentions; the agent never re-reads the whole lease.** Accepted fields are locked. Re-reading the lease on every turn could quietly change values the user already approved, because model output varies from run to run. A typed correction is recorded with the user's message as its source, so the record stays traceable.
- **The model extracts and code decides.** Rules R1–R7, date calculations, unit matching and quote checks are plain TypeScript with unit tests. Rules are loaded from `data/owner_ruleset.json`, and every lease review records the ruleset version it was checked against.
- **Tool calling where the agent has to decide; fixed steps elsewhere.** The first extraction is a single structured-output call. In the review loop and the issue flow, the agent chooses among tools: `search_clauses`, `update_field`, `find_unit`, `evaluate_rules`, `get_unit_lease`, `draft_work_order`, `ask_user`. There is no tool for confirming, saving or changing occupancy; only the user's button does that. Tool arguments are schema-checked, each turn is capped at about 6 steps, and every call is logged.
- **No second "judge" AI.** Code checks and human review already cover verification more reliably, at no extra cost or delay. The useful cross-checking (for example, who pays for a repair) happens through `get_unit_lease`.
- **PDF and DOCX leases now; images later.** Both are converted to text and split into clauses. Images and scanned PDFs would be transcribed by the vision model and flagged as "transcribed from image", because their citations could only be checked against the model's own transcription (roadmap).
- **Occupancy changes only when the user confirms.** If a high-severity rule fails, confirming needs an override reason.
- **No fixed lease template.** The agent reads whatever lease is uploaded. Leases come from many sources (old leases, broker drafts, other templates), so the AI does the reading and a person corrects it. Every extracted field can be accepted, rejected or edited, and the rules run again on the corrected values.
- **SQLite now, with the database kept swappable.** SQLite needs no server: `npm install` and it runs, which matters for reviewers starting the project. To keep the database replaceable:
  - The app's logic talks to *repository interfaces* (`UnitRepository`, `LeaseRepository`, …), never to a database driver.
  - The repositories use [Kysely](https://kysely.dev), a typed SQL query builder that supports SQLite, Postgres and MySQL. Switching databases means changing the dialect in one file and setting `DATABASE_URL`, not rewriting queries.
  - Migrations stick to portable SQL types. Structured records (a lease's extracted fields, chat cards) go in JSON columns: `TEXT` in SQLite, `jsonb` in Postgres. Every JSON column is parsed with the shared Zod schema when it's read, so a bad row fails loudly instead of reaching the UI.
  - Migrations are TypeScript objects registered in one list (no file scanning), so they run the same under `tsx`, Vitest and a build.
  - A `postgres://` URL currently stops with a clear "not wired yet" error rather than adding a Postgres driver nobody uses yet.
  - **Trade-off:** SQLite allows only one writer at a time, so it's the first thing to replace when there are many users. That's the first item under "Where it breaks first at scale".
- **Few dependencies, all actively maintained and widely used.** Every package must have a recent release, strong weekly downloads and TypeScript types. For example, PDFs are read with `unpdf` (built on Mozilla's pdf.js, released in the last few months), not the better-known `pdf-parse`, whose last release is almost a year old.
- **The browser talks to the API through the Vite dev proxy.** The web app calls `/api/...` on its own origin and Vite forwards it to the API. That means no CORS setup and no API URL to configure, and it behaves the same on localhost and behind a remote proxy. In production the same path would be routed by the reverse proxy.
- **Standard library over small packages.** `.env` is loaded with Node's built-in `process.loadEnvFile` (no `dotenv`) and validated with Zod at startup, so a bad value fails loudly. The shared package is consumed as TypeScript source (no build step) by `tsx` in the API and Vite in the web app.
- **Zustand for global UI state, only where it's needed.** We have used it before; it's small, hook-based and needs no provider or boilerplate. Local component state stays in `useState`, and server data comes from the API client. A store is added only for state shared across screens (e.g. the open conversation).
- **Cheap model by default.** `OPENROUTER_MODEL` defaults to `xiaomi/mimo-v2.6-pro` (`z-ai/glm-5.3-flash` is cheaper still). Both take images, call tools and return JSON, which both agents need, at a small fraction of a frontier model's price. Swapping models is a config change.
- **One set of schemas for API, agent and UI.** `packages/shared` defines every domain type with Zod (lease record, sourced field, flag, rule result, issue, work order, conversation, message, card, action). Each extracted field carries its value, its source (a clause and quote, or the user message that changed it), a confidence and a review state. A card's allowed actions come from one map (`ALLOWED_ACTIONS`), so the UI and the API can't disagree about what a card supports.
- **One model interface, and a stub that runs without a key.** Agents call a single `complete()` function for structured output, tool calls and images. Without `OPENROUTER_API_KEY` the app uses a stub model: it returns photo assessments from `data/sample-photos/expected.json` and handles plain-English corrections with a small parser (for example "rent is 8500" becomes an `update_field` call, while "change it" makes it ask a question), so reviewers can run the whole app without a key or network. With a key, the same interface goes to OpenRouter through the `openai` SDK (OpenRouter is OpenAI-compatible, and the SDK is maintained, typed and very widely used).
  - **Model output is checked like any other input.** Structured output is checked against the Zod schema. If it's invalid, the model gets one retry with the validation error, and after that the call fails with a clear error. An upstream failure (`finish_reason: error`) fails right away. Every model call logs one line with the purpose, model, tokens, time taken and result, never the content or the key.
  - **Tool errors go back to the model, not to the user.** Every tool argument is checked with Zod. A bad argument, an unknown tool or a failing handler is sent back to the model as the tool's result so it can correct itself. A turn ends when the model gives a final reply or calls `ask_user`, or after 6 steps. Every tool call is logged and returned to the caller so it can be stored with the message.
  - **Tool arguments use one type per field.** In testing, `xiaomi/mimo-v2.6-pro` failed upstream whenever a tool argument allowed two types (`string | number`). Tool schemas therefore give each field a single type.
- **Term length counts the expiry date as inclusive.** A lease from 1 Nov 2026 to 31 Oct 2028 is 24 months. Rule R4 uses this convention. A span that isn't a whole number of months (for example a lease starting on 31 January) fails R4 so a person looks at it, rather than being rounded.
- **Rules give one of three results: PASS, FAIL or NOT_DETERMINABLE.** Each rule is a small function in `apps/api/src/services/leases/rules.ts`. The ruleset (which rules run, their severity and version) is read from the database, which is seeded from `data/owner_ruleset.json`. Every result records the ruleset version, the clauses it relied on and a reason with the actual numbers (for example "Deposit QAR 5,000 is less than monthly rent QAR 6,200"). A missing value gives NOT_DETERMINABLE, never a guessed PASS or FAIL. A rule in the ruleset with no matching code also comes back NOT_DETERMINABLE, so the gap shows up in review.
  - **Rent is normalised to monthly.** Quarterly or annual rent is divided down to a monthly amount (and flagged as derived) before R1 and R6 compare it. R6 allows a difference of 1 currency unit for rounding.
  - **Only the unit ID is trusted for an automatic match; otherwise the owner confirms.** Linking a lease to the wrong unit marks the wrong unit occupied, which costs far more than one click. If the lease states a unit ID that is in the owner's records, the unit is matched. If not, the agent asks the owner, suggesting likely units: the unit page the upload started from, units whose label appears in the premises text, and units with the same parking bay. Until the owner chooses, R7 is NOT_DETERMINABLE. If there is nothing to suggest, R7 fails ("not in owner records"). The owner's choice is recorded as the unit ID, with their message as its source. A lease that names a different unit from the page it was uploaded on raises a flag.
  - **Flags are for data problems; rules are for policy.** Flags cover missing fields, contradictions (stated term vs dates, annual vs monthly rent), missing signatures, odd values and how the unit was matched. Policy breaches, such as a term over 36 months or an occupied unit, appear as rule results and are not repeated as flags. The checks are tested against all five sample leases and `data/sample-leases/expected.json`.

## How this was built

Built with AI coding tools, as the brief invites. Planning lives in `docs/tasks/` (one file per task, split into phases with Tasks and Results), and the working rules are in `CLAUDE.md`. Every phase follows the same loop:
1. **Plan:** Claude Code writes a precise brief for the phase.
2. **Implement:** a second coding agent (via agy-bridge) writes the code.
3. **Seed and test:** load the sample data and run typecheck, unit tests and an end-to-end check on the stub model.
4. **Review:** Claude Code reviews the full diff against the standards, and the two loop until it's clean.

Splitting writing from reviewing means no agent signs off its own work.

## Where it breaks first at scale

1. **SQLite allows one writer at a time.** Many owners reviewing and many tenants reporting at once would queue on writes. Fix: switch the Kysely dialect to Postgres.

## Roadmap: toward a property management system

Everything below was designed during planning but is **not built**. The brief's requirements came first. Items 1–5 are ready to start next, in this order, and the first ones get built if time allows. The order follows what saves an owner the most time or money soonest.

### Next: make it usable by a real team

**1. Login and roles.** Login wasn't part of the brief, so there's no full login feature. The first step would be a test-only version that shows permissions working:
- Test accounts in `data/users.json` (owner / `owner123`, inspector / `inspector123`) with **plain-text passwords**, deliberately and for testing only, so reviewers can sign in as each role.
- Signing in returns a random session token kept in the API's memory.
- **The real part is the role check on every API route.** That's the code we'd keep.
- **Production would instead:**
  - Not store passwords at all: sign in with Google or Microsoft, or use a managed auth service. At minimum, hash them with argon2 or bcrypt.
  - Use secure HTTP-only cookies with expiry.
  - Add rate limits on login, password reset and an audit log.
  - Let an admin assign owners and inspectors, with support for several owners.

  Only the code that identifies the user changes; the permission checks stay as they are.

| Area | Owner | Inspector | Tenant (no account) |
|---|---|---|---|
| Lease records (upload, review, confirm) | ✅ | ❌ | ❌ |
| Reports (list, photos, AI assessment, work order status) | ✅ all units | ✅ all units | Their unit only, public messages |
| Create a report | ✅ pick any unit | ✅ pick any unit | ✅ unit fixed by the QR link |
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

**5. Settings and rule versions.** Owners manage units and each rule's threshold, severity and on/off state. Each change creates a new ruleset version, and every lease keeps the version it was checked against.

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

### Later: change how leases are made

**10. Fast path for the owner's own template.** Read leases on the owner's standard template with plain code, and send everything else to the AI agent.

**11. Create leases inside the product.** Build the lease from a structured record and produce the PDF from it. There's nothing to extract, and the rules are checked before signing, not after.

**12. Rules in plain language.** The owner writes a rule ("3BR units must include parking"). The AI proposes a structured rule, the owner approves it, and it becomes a new ruleset version.
