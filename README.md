# TrueLinks Lease & Issue Agents

A small full-stack service where AI agents turn a lease document into a structured, verifiable lease record, validate it against an owner's rules, and turn property photos into draft work orders, all linked to the unit.

This is the first slice of what would become a **property management system**. The build covers the brief's requirements; the bigger system is in the [Roadmap](#roadmap). Full detail on every section below, including the API and the reasoning behind each decision, is in [`docs/design.md`](docs/design.md).

## My approach

**Stack used**
- Node.js, Express
- Vite
- Plain CSS (no Tailwind; fine for small projects, otherwise it's Tailwind)
- SQLite (not my usual, but for a simplified, quick project this would be my choice; otherwise it would be PostgreSQL)

**Project structure**
- Monorepo with shared dependencies.
- Easy to maintain, even with a team.
- My usual setup from previous projects, since most projects need full-stack features.

**Backend structure**
- Layered structure: routes are the entry for the API endpoints, services hold the logic, then repositories make the database calls.
- My usual setup as well. If a feature needs an update to its logic only, only the services are touched.
- I also made sure the database can easily be switched to PostgreSQL if needed. To be honest, this is my first time using Kysely and Zod; we usually use Knex or Ts.ED with TypeORM.

**Frontend structure**
- Organized folders: components (headers, cards, layouts, buttons, etc.), hooks (state managed through hooks, like useFilter, etc.), pages that reuse and combine components from the components folder, utils for helper functions, and styles for the CSS.

**Improvements I suggest, which I wasn't able to handle in the four-day timeline**
- Login for the owner, the reporter and the tenant.
- The owner views everything; a reporter sees only issues and can create issues themselves; a tenant can view the status of their issues for follow-ups or records.
- Each unit has its own QR code; scanning it goes to the reporting page with the unit preselected.
- When a tenant submits photos, upload the files to the server, then trigger the analysis after a successful submit, because photo analysis sometimes takes time. Then notify the tenant that the submission succeeded, or of any updates. This might remove the need for tenants to log in.
- A lease format creator, so we can easily map the fields of new leases.
- Lease ruleset management. Tenant can add, edit or delete existing rules.
- Property unit management. Maybe they have new units available for rent, so they can add or delete units, or maybe the owner manages multiple properties.
- A better UI/UX for our app. Since property owners will be accessing it, they should spend less time in our app: fewer clicks to reach what they want to do, and clear indicators.
- A central report for the owner: total issues, issues solved, urgent issues, units' total monthly earnings, issue costs, etc.

## Run it

Requires Node 24+. No API key needed: without `OPENROUTER_API_KEY` a stub model answers from the sample fixtures, so the whole app runs offline.

```bash
cp .env.example .env      # optional: add OPENROUTER_API_KEY to use real models
npm install
npm run dev               # API on :8083, web on :3000 → open http://localhost:3000
npm test                  # end-to-end tests (Playwright; first run: npx playwright install chromium)
npm run typecheck
npm run db:seed           # optional: migrations + seed without starting the API
```

- On first start the API creates `var/app.db`, runs migrations and seeds the units, the owner ruleset and the current leases of the occupied units. Seeding only inserts what's missing, so it's safe to repeat. Delete `var/app.db` to start over.
- A fresh clone needs no Python or C++ toolchain (`.npmrc` sets `ignore-scripts=true`; see Decisions).
- The web app calls the API through Vite's `/api` proxy, so only port 3000 needs to be reachable. Extra hostnames go in `WEB_ALLOWED_HOSTS`.

## What you can do

- **Review a lease.** "New lease review" → upload a PDF, DOCX, PNG or JPEG. The agent extracts every field with its clause and quote, runs the owner's rules and shows cards for what needs attention. Accept, reject or edit each card, or type a correction ("rent is 8,500"); then confirm. A background pass adds conflicts and vague terms a few seconds later.
- **Report an issue.** "Report an issue" → pick the unit, upload 1–6 photos. Each photo is assessed (condition, damage, equipment); if there is damage, the agent reads the unit's lease and drafts one work order with who is responsible. Accept, reject, edit or correct it.
- **See a unit.** The sidebar lists units with occupancy. A unit page shows the current and next lease, then two tabs, **Issues** and **Lease records**, with status filters kept in the URL. Reviews whose unit isn't chosen yet are under **Unassigned leases**.
- **Archive and delete.** Any row or thread can be archived (a confirmed lease only once it has ended); only an archived item can be deleted.
- **Settings.** Add, edit, delete and restore owner rules (each change is a new ruleset version), and add units.

The API endpoints for each of these are listed in [design notes → Using the app and the API](docs/design.md#using-the-app-and-the-api).

## Repository layout

```
apps/api/src
  routes/       HTTP endpoints: validate the request, call a service, send the response
  services/     Business logic (lease review, rules, unit matching, work orders)
    agents/     Lease and issue agents, their prompt files, model provider (OpenRouter + stub)
  db/           Kysely setup, schema types, repositories, seed
  migrations/   Database migrations, numbered and run in order on start
  middleware/   Express middleware (request log, error handler)
  utils/        Small pure helpers
apps/web/src
  pages/        One component per screen
  components/   Reusable React components (cards, lists, dialogs)
  hooks/        Custom hooks
  utils/        Helpers, including the typed API client (utils/api.ts)
  styles/       Plain CSS by area: tokens (light + dark), base, shell, thread, cards, issue, settings
packages/shared Shared types and Zod schemas (API, agent output, UI)
data/           Owner ruleset, units, sample leases and photos
scripts/        Dev utilities (sample data generation)
e2e/            Playwright end-to-end tests, one spec per user flow
docs/tasks/     The plan: one file per task, split into phases
```

## Sample data

`data/owner_ruleset.json` and `data/units.json` came with the brief. The leases are generated (`npm run samples:leases`), each built to exercise specific rules or formats; `data/sample-leases/expected.json` holds the expected outcomes.

| File | Unit | Exercises |
|---|---|---|
| `lease-01-clean-MC-B-1204.pdf` | MC-B-1204 (available) | Happy path — all rules PASS |
| `lease-02-problems-MC-B-0902.pdf` | MC-B-0902 | R1, R2, R4, R5, R6 FAIL; no unit ID, so the owner confirms the unit |
| `lease-03-occupied-MC-B-1205.pdf` | MC-B-1205 (occupied) | R3 FAIL (48 months); R7 FAIL: overlaps the current lease, so confirming is refused |
| `lease-04-quarterly-no-deposit-MC-A-0301.pdf` | MC-A-0301 | Quarterly rent normalised to monthly; no deposit → R1 NOT_DETERMINABLE |
| `lease-05-unknown-unit-rent-conflict.pdf` | Tower C (not in records) | R7 FAIL; conflicting monthly rent (8,500 vs 8,000) is flagged, not silently resolved |
| `lease-06-long-MC-B-1204.pdf` | MC-B-1204 | 4 pages, 22 clauses, clauses across page breaks; 36-month term (R3 boundary) |
| `lease-07-docx-MC-A-0302.docx` | MC-A-0302 (occupied) | DOCX; annual rent only; R7 PASS as the next lease |
| `lease-08-image-MC-A-0301.png` | MC-A-0301 | Image input, transcribed by the model |
| `lease-09-inline-headings.pdf` | MC-B-1204 | Inline headings and parties in prose: the AI marks the clause headings |

`data/current-leases/` holds the leases in effect on the two occupied units (MC-A-0302 to 28 Feb 2027, MC-B-1205 to 30 Jun 2027). On start the API imports each through the normal pipeline and confirms it, so new leases are checked against them by date.

`data/sample-photos/` holds AI-generated issue photos (prompts in `PROMPTS.md`); `expected.json` was written from what each photo actually shows.

| Scenario | Unit | Exercises |
|---|---|---|
| `issue-01-ac-leak` | MC-B-1204 | AC leak → HVAC work order; landlord responsible (lease 01 §7) |
| `issue-02-tap-drip` | MC-B-0902 | Two faults; responsibility is split by a cost threshold, so the agent surfaces it, not decides |
| `issue-03-water-heater` | MC-A-0301 | Leaking heater with exposed wiring → high severity, urgent safety advice |
| `issue-04-move-in-ok` | MC-B-1204 | Undamaged rooms → inventory, no work order (no false positives) |
| `issue-05-unclear` | MC-A-0301 | Dark, blurry photo → asks for a clearer one instead of guessing |

## How it works

**Two flows, joined by the unit.**

- **Lease (owner):** upload → code splits it into clauses → the AI extracts each field with its clause and quote → code checks the quotes, matches the unit and runs rules R1–R7 → the agent asks about what needs attention → the owner accepts, rejects, edits or types corrections, then confirms → the lease goes on the unit's timeline (occupied now if it's in effect today, otherwise the unit's next lease).
- **Issue (tenant or inspector):** photos → the AI assesses each one → code decides whether a work order is needed → the agent reads the unit's lease and drafts the work order with who is responsible → a person accepts, rejects or edits it.
- **Unit page:** the current and next lease plus the unit's issues and work orders in one place.

## Scope

**Built:** everything the brief asks for: lease extraction with sources, flags, rule validation, unit matching and occupancy update, photo assessment and draft work orders, accept/reject/edit on every field, flag and work order, and the unit page. Runs with a stub model (no key) or real ones through OpenRouter.

**Left out on purpose** (to deliver the brief in four days): login and roles, tenant QR reporting, ticket statuses, notifications, editing units, occupancy that follows lease dates, scanned PDFs, streaming responses. All are in the [Roadmap](#roadmap). Issues found in the last manual test that we chose not to fix are in [`docs/tasks/12-known-issues.md`](docs/tasks/12-known-issues.md).

## Decisions

The short version; each one is explained in [design notes → Decisions](docs/design.md#decisions).

**AI**
- **The model extracts, code decides, the human confirms.** Rules, date math, unit matching and quote checks are plain TypeScript with no I/O. There is no tool for confirming or changing occupancy; only the owner's button does that.
- **Every field carries its source.** A clause and verbatim quote (checked by code), or the user message that changed it. An unverifiable quote is flagged, never silently accepted.
- **Review happens in a chat with cards.** A correction patches only the fields it mentions; accepted fields are locked, and the lease is never re-extracted.
- **Extraction runs in two passes.** A fast model returns the fields in 4–6 s while the owner waits; a reasoning model looks for conflicts and vague terms in the background.
- **Two cheap models, chosen by measurement.** `google/gemini-3.5-flash-lite` for extraction and transcription, `xiaomi/mimo-v2.6-pro` for judgement and tool calls. Eight models were compared on accuracy, not just speed.
- **Tool calling only where the agent has to decide.** Tool arguments are Zod-checked, turns are capped at 6 steps, and every call is logged.
- **A stub model behind the same interface,** so the whole app and its tests run without a key or network.
- **No second "judge" AI.** Code checks and human review cover verification more reliably at no extra cost.

**Domain**
- **Rules return PASS, FAIL or NOT_DETERMINABLE** with the clause and a reason; a missing value is never guessed. Owner rules that compare fields are checked by code; plain-language rules are judged by the model with a verified quote and labelled "checked by AI".
- **R7 reads "available" as "no lease in effect for those dates",** so the next tenant can be signed before the current one leaves; overlapping leases are refused at confirm.
- **Only the unit ID is trusted for an automatic match;** otherwise the owner chooses, because linking the wrong unit is costly.
- **One work order per report; responsibility is advice** backed by a quoted lease clause.
- **Amounts only in QAR,** never converted. **Term length counts the expiry date as inclusive.**
- **Archiving is a flag, not a status,** so unarchiving restores the item as it was. Delete needs archiving first.

**Engineering**
- **SQLite now, swappable later:** repository interfaces over Kysely, portable migrations, JSON columns parsed with Zod on read.
- **One set of Zod schemas** in `packages/shared` for the API, the agents and the UI.
- **Few dependencies,** each actively maintained, widely used and typed; the standard library where it's enough (`process.loadEnvFile`, no `dotenv`).
- **Plain CSS, no framework.** Styles are split by area in `apps/web/src/styles/`, with light and dark themes as CSS custom properties in `tokens.css`. The UI is small enough that a utility framework or CSS-in-JS would add a dependency and a build step without saving much.
- **React Router** (`HashRouter`) for navigation. No global store yet: nothing is shared across screens that the URL and the API don't already hold (Zustand is approved for when something is).
- **The browser reaches the API through the Vite proxy:** no CORS, no API URL to configure.
- **End-to-end tests instead of unit tests:** Playwright on the stub model with an in-memory database, finding controls by accessible name. The trade-off: pure functions aren't tested one by one.
- **Install scripts off** (`ignore-scripts=true`), so a fresh clone installs anywhere without compiling `better-sqlite3`.

## How this was built, and how a team carries it on

Built with AI coding tools, as the brief invites, and set up so several people, each with their own coding agent, work from the same instructions.

- **Same instructions for everyone.** `CLAUDE.md` (a link to `docs/CLAUDE.md`) holds the stack, layout, code standards, dependency and testing rules, the AI rules and the workflow; `apps/web/CLAUDE.md` adds the UI direction. The app's agent prompts are files next to the agents (`apps/api/src/services/agents/prompts/`), versioned and reviewed like code.
- **Boundaries for working in parallel.** The shared Zod schemas are the contract; routes, services and repositories are separate layers; the database and the model provider sit behind interfaces. Planning lives in `docs/tasks/`, one file per task, split into phases; a phase is the unit one person picks up.
- **The loop for each phase:** plan → skeleton (placeholders and `PLAN:` comments, reviewed by a person before any real code) → implement (a second coding agent, via agy-bridge) → seed and test → review (Claude Code, against `CLAUDE.md` and the skeleton) → record Results and update this README. A phase changes at most 15 files, so each is a pull request a reviewer can read in one sitting.
- **How it was actually applied.** The skeleton step and the 15-file limit were added on 7 October 2026, after most tasks were done; earlier phases went from plan straight to implementation and were sometimes larger. Splitting writing from reviewing means no agent signs off its own work. The one exception: when the second agent ran out of quota during task 04 phase 2, Claude Code wrote the rest, and that task's Results say which parts.

## Where it breaks first at scale

1. **SQLite allows one writer at a time.** Fix: switch the Kysely dialect to Postgres.
2. **Uploaded files live on the API server's disk.** Fix: object storage, keyed by the same document ID.
3. **Background lease analysis runs inside the API process.** A restart leaves a lease `pending`, and many uploads call the model at once. Fix: a job queue with retries and a concurrency limit.
4. **The unit page loads every conversation and filters in the browser.** Fine for hundreds, slow for thousands. Fix: filter and page on the server, keeping the same URL filters.

## Roadmap

Designed but **not built**; each item is described in full in [design notes → Roadmap](docs/design.md#roadmap-toward-a-property-management-system).

**Next: make it usable by a real team**
1. **Roles** (owner, inspector, tenant), with one-click role shortcuts first and a role check on every API route.
2. **Tenants report by QR code**, with no account: a private link per unit.
3. **Reports become tickets**, with statuses, public and internal messages, follow-ups and duplicate detection.
4. **Notifications:** an in-app inbox, then email and WhatsApp.
5. **More settings:** edit or retire units, switch rules off, choose the AI models.

**Then: reduce manual work**

6. **More lease formats:** scanned PDFs and bilingual Arabic/English leases.
7. **Move-in inspection** photos, compared at move-out to support deposit decisions.
8. **Learn from corrections** to measure extraction accuracy per field.
9. **Faster maintenance:** response-time targets, contractor assignment, recurring-issue analytics.
10. **Occupancy follows the lease dates:** a sync job run by an external scheduler, not a timer in the API.

**Later: change how leases are made**

11. **A fast path** for the owner's own template, read by plain code.
12. **Create leases inside the product**, checked against the rules before signing.
13. **Rules in plain language**, turned into structured rules the owner approves.
