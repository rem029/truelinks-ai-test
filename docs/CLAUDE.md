# TrueLinks.AI take-home — Lease & Issue Agents

Full-stack service: an AI agent turns a lease into a verified lease record (Part A), another turns unit photos into a draft work order (Part B), both reviewed by a human and joined on the unit page.
Brief: `docs/attachments/Solution-brief-explained.docx` (summary in `docs/email.txt`). Plan: `docs/tasks/00-plan.md`.

## Commands
- `npm install` — install all workspaces
- `npm run dev` — API (8083) + web (3000)
- `npm test` — unit tests (Vitest)
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
- Tests sit next to the file they test (`rules.ts` → `rules.test.ts`).

## Code standards
**Simple, easy to debug, easy to maintain.** This code is read as the standard for a team — optimise for the next reader.
- Prefer plain functions and data over classes, patterns and abstractions. Add an abstraction only when there's a second real use (exceptions: the repository and model-provider interfaces, which exist for swapping).
- Small files with one job. Name things for what they mean in the domain (`lease`, `unit`, `workOrder`, `ruleResult`).
- Relative imports use the real `.ts` extension (`import { evaluateRules } from './rules.ts'`); `allowImportingTsExtensions` is on and nothing is compiled to `.js`.
- TypeScript `strict`. No `any`; validate external input (HTTP bodies, model output, files) with Zod at the boundary, then trust the types inside.
- Pure logic (rules, date math, unit matching, quote checks) has no I/O, so it's trivially unit-testable.
- Errors: fail loudly with a clear message; never swallow. One Express error handler returns `{ error, details }`. Don't catch just to rethrow.
- Logging: one line per request and per model/tool call (what, inputs summary, duration, result). No secrets or full documents in logs.
- Comments explain *why*, not *what*. No commented-out code.
- No premature optimisation, caching or config options nobody asked for.

## Dependencies
Before adding a package, check it is **actively maintained** (release in the last ~6 months, issues answered), **widely used** (strong weekly downloads, many dependents) and **has types**. Prefer the standard library or a few lines of code over a package for small things. Record why each non-obvious dependency was chosen in README → Decisions.
Approved so far: express, zod, multer, kysely, better-sqlite3, openai, unpdf, mammoth, react, react-dom, zustand, vite, @vitejs/plugin-react, vitest; dev tooling: typescript, tsx, concurrently, @types/*, pdfkit, docx and @napi-rs/canvas (sample lease generation only).

## Testing
- Unit-test all deterministic logic: rule engine R1–R7, term/date math, rent normalisation, unit matching, quote verification, patch/lock logic.
- Use `data/sample-leases/expected.json` and `data/sample-photos/expected.json` as fixtures.
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
- `docs/`: only `docs/tasks/` and `docs/CLAUDE.md` are committed. The brief, email and attachments are private — never commit them.
- `CLAUDE.md` (root) → symlink to `docs/CLAUDE.md`. Edit the file in `docs/`.
- `.claude/` (root) → symlink to `docs/.claude/` (gitignored). Plugins are installed at user scope (Claude Code won't write settings through a symlinked `.claude`).
- Runtime files live outside `docs/` (e.g. `data/`). Secrets only in `.env` (gitignored); document every variable in `.env.example`.

## Workflow
**Per task/phase loop: plan → implement (agy-bridge) → seed → test → review (Claude) → update Results + README → commit when asked.**
1. **Plan:** Claude reads the task file and writes a precise brief for the phase: goal, files to touch, interfaces/schemas, acceptance criteria, which standards in this file apply.
2. **Implement with agy-bridge:** Claude delegates the implementation via `mcp__agy-bridge__delegate` (use `follow_up` to iterate on the same job). Claude does not hand-write the feature code; small fixes after review may go back through `follow_up`.
3. **Seed:** make sure the data the phase needs exists and is loaded — run migrations + idempotent seed (`data/units.json`, `data/owner_ruleset.json`, sample leases/photos, `expected.json` fixtures). Add seed data in the same phase if missing.
4. **Test:** run `npm run typecheck` and `npm test`; exercise the phase end-to-end against the seeded data with the stub provider (curl the API or drive the UI). Every phase ships with tests for its logic.
5. **Review (Claude):** read the full diff against this file's standards and the task's acceptance criteria — correctness, simplicity, naming, error handling, logging, security, dependency rules. Use `mcp__agy-bridge__adversarial_review` as a second opinion on risky changes. Send findings back via `follow_up`; repeat 2–5 until clean.
6. **Record:** tick the task's checklist, fill in **Results**, update README in the same change.

- Tasks in `docs/tasks/NN-name.md`, split into phases; each phase has **Tasks** (checklist) and **Results** (what was done, decisions, follow-ups). Template: `docs/tasks/_template.md`. Update Results when a phase finishes.
- **`README.md` is the deliverable — keep it current in the same change.** Every feature, sample data, script, decision, trade-off, scale concern or product idea goes into README as we go, not at the end.
- Small, focused commits with a clear message saying what and why. Commit only when asked.
