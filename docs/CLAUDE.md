# TrueLinks.AI take-home — Lease & Issue Agents

Full-stack service: an AI agent turns a lease into a verified lease record (Part A), another turns unit photos into a draft work order (Part B), both reviewed by a human and joined on the unit page.
Brief: `docs/attachments/Solution-brief-explained.docx` (summary in `docs/email.txt`). Plan: `docs/tasks/00-plan.md`.

## Commands
- `npm install` — install all workspaces
- `npm run dev` — API (8083) + web (3000)
- `npm test` — end-to-end tests (Playwright, `e2e/`; own ports 3010/8093, in-memory DB, stub model, video per test). First run: `npx playwright install chromium`. Report: `npx playwright show-report`
- `npm run typecheck` — `tsc --noEmit` across workspaces
- `npm run samples:leases` — regenerate sample lease PDFs
- `npm run db:seed` — migrations + idempotent seed against `DATABASE_URL` (the API also does this on start)
(Keep this list in sync with `package.json` scripts.)

## Stack
- `apps/api` — Express 5 + TypeScript, Zod, multer, SQLite via Kysely behind repository interfaces (swap DB via `DATABASE_URL`)
- `apps/web` — Vite + React + TypeScript
- `packages/shared` — shared types and Zod schemas (single source of truth for API, agent output and UI)
- `data/` — `owner_ruleset.json`, `units.json`, sample leases and photos (+ `expected.json` ground truth)
- Model: OpenRouter (OpenAI SDK) behind a provider interface; stub provider when `OPENROUTER_API_KEY` is unset

## Folder structure
- `apps/api/src`: `routes/` (endpoints: validate input with Zod, call a service, respond; no business logic), `services/` (business logic; no `req`/`res`) with `services/agents/` (lease + issue agents, prompt files, model provider), `db/` (Kysely setup, schema types, seed, repositories: data access only, no business logic), `migrations/` (database migrations, numbered `NNN_name.ts`; never edit one that has been committed, add a new one), `middleware/` (Express middleware), `utils/` (small pure helpers). `env.ts`, `app.ts`, `server.ts` at the root.
- `apps/web/src`: `pages/` (one component per screen), `components/` (reusable), `hooks/` (when needed), `store/` (Zustand, only for state shared across screens), `utils/` (helpers; `utils/api.ts` is the only place that calls `fetch`), `styles/` (plain CSS by area: tokens, base, shell, thread, cards, issue; no inline styles).
- Create a folder when its first file arrives; no empty placeholder folders.
- End-to-end tests live in `e2e/`, one spec per user flow. No unit test files.

## Code standards
**Simple, easy to debug, easy to maintain.** This code is read as the standard for a team — optimise for the next reader.
- Prefer plain functions and data over classes, patterns and abstractions. Add an abstraction only when there's a second real use (exceptions: the repository and model-provider interfaces, which exist for swapping).
- Small files with one job. Name things for what they mean in the domain (`lease`, `unit`, `workOrder`, `ruleResult`).
- Relative imports use the real `.ts` extension (`import { evaluateRules } from './rules.ts'`); `allowImportingTsExtensions` is on and nothing is compiled to `.js`.
- TypeScript `strict`. No `any`; validate external input (HTTP bodies, model output, files) with Zod at the boundary, then trust the types inside.
- Pure logic (rules, date math, unit matching, quote checks) has no I/O, so it's easy to reason about and reuse.
- Errors: fail loudly with a clear message; never swallow. One Express error handler returns `{ error, details }`. Don't catch just to rethrow.
- Logging: one line per request and per model/tool call (what, inputs summary, duration, result). No secrets or full documents in logs.
- Comments explain *why*, not *what*. No commented-out code.
- No premature optimisation, caching or config options nobody asked for.

## Dependencies
Before adding a package, check it is **actively maintained** (release in the last ~6 months, issues answered), **widely used** (strong weekly downloads, many dependents) and **has types**. Prefer the standard library or a few lines of code over a package for small things. Record why each non-obvious dependency was chosen in README → Decisions.
Approved so far: express, zod, multer, kysely, better-sqlite3, openai, unpdf, mammoth, react, react-dom, react-router, zustand, vite, @vitejs/plugin-react; testing: @playwright/test; dev tooling: typescript, tsx, concurrently, @types/*, pdfkit, docx and @napi-rs/canvas (sample lease generation only).

## Testing
- Playwright end-to-end tests in `e2e/` cover each user flow through the UI, on the stub provider with the sample files in `data/`.
- Find elements by role and accessible name (`getByRole`), not CSS selectors, so the tests also catch controls a keyboard or screen reader can't reach.
- The whole app must run end-to-end with the stub provider (no API key).
- Run `npm run typecheck` and `npm test` before every commit.

## AI / agent rules
- Model extracts and proposes; **code decides** (rules, quote checks, unit match); **the human confirms**.
- Every extracted field carries its source (clause + verbatim quote, or user message). Unverifiable → flag, never silently accept.
- Corrections patch only affected fields; accepted fields are locked; never re-extract the whole lease.
- No tool may confirm, commit or change occupancy — user action only.
- Tool args validated with Zod; max ~6 steps per turn; every call logged.
- Prompts live in their own files next to the agent, versioned with the code.

## Dev environment
- Ports: web **3000**, API **8083**. The web app reaches the API via Vite's `/api` proxy (no CORS). Extra hostnames go in `WEB_ALLOWED_HOSTS` in `.env` — never hardcode them.
- Machine-specific setup (private, gitignored): @docs/dev-env.md

## Repo & files
- Remote: `git@github.com:rem029/truelinks-ai-test.git` (branch `main`).
- `docs/`: only `docs/tasks/`, `docs/CLAUDE.md` and `docs/design.md` (the full detail behind README) are committed. The brief, email and attachments are private — never commit them.
- `CLAUDE.md` (root) → symlink to `docs/CLAUDE.md`. Edit the file in `docs/`.
- `.claude/` (root) → symlink to `docs/.claude/` (gitignored). Plugins are installed at user scope (Claude Code won't write settings through a symlinked `.claude`).
- Runtime files live outside `docs/` (e.g. `data/`). Secrets only in `.env` (gitignored); document every variable in `.env.example`.

## Workflow
**Per task/phase loop: plan → skeleton (user reviews) → implement (agy-bridge) → seed → test → review (Claude) → update Results + README → commit when asked.**
**Size limit:** a phase changes **1–15 files** in total, counting tests, docs and README, so it can be reviewed in one sitting. If the plan needs more, split the phase into smaller ones before starting.
1. **Plan:** Claude reads the task file and writes a precise brief for the phase: goal, the list of files to touch (new and changed, within the limit), interfaces/schemas, acceptance criteria, which standards in this file apply.
2. **Skeleton (before any real code):** Claude lays out the change for the user to review.
   - New files are created as placeholders: imports, exported types and function signatures, and a pseudocode comment in each body saying what it will do (the body throws `new Error('Not implemented')` so nothing half-built runs).
   - Existing files get a short `// PLAN:` pseudocode comment at each place that will change, saying what changes and why. No real edits yet.
   - Claude then stops and lists the skeleton files; implementation starts only after the user approves or adjusts it. Every `PLAN:` comment and placeholder is replaced by real code in step 3 (none may reach a commit).
3. **Implement with agy-bridge:** Claude delegates the implementation via `mcp__agy-bridge__delegate` (use `follow_up` to iterate on the same job), following the approved skeleton. Claude does not hand-write the feature code; small fixes after review may go back through `follow_up`.
4. **Seed:** make sure the data the phase needs exists and is loaded — run migrations + idempotent seed (`data/units.json`, `data/owner_ruleset.json`, sample leases/photos, `expected.json` fixtures). Add seed data in the same phase if missing.
5. **Test:** run `npm run typecheck` and `npm test`; exercise the phase end-to-end against the seeded data with the stub provider (curl the API or drive the UI). A phase that adds or changes a user flow updates or adds its spec in `e2e/`.
6. **Review (Claude):** read the full diff against this file's standards, the approved skeleton and the task's acceptance criteria — correctness, simplicity, naming, error handling, logging, security, dependency rules; confirm no `PLAN:` comments or placeholders remain. Use `mcp__agy-bridge__adversarial_review` as a second opinion on risky changes. Send findings back via `follow_up`; repeat 3–6 until clean.
7. **Record:** tick the task's checklist, fill in **Results**, update README in the same change.

- Tasks in `docs/tasks/NN-name.md`, split into phases; each phase has **Tasks** (checklist) and **Results** (what was done, decisions, follow-ups). Template: `docs/tasks/_template.md`. Update Results when a phase finishes.
- **`README.md` is the deliverable — keep it current in the same change.** Keep it short; the full reasoning goes in `docs/design.md`. Every feature, sample data, script, decision, trade-off, scale concern or product idea goes into README as we go, not at the end.
- Small, focused commits with a clear message saying what and why. Commit only when asked.
