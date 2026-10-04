# TrueLinks.AI take-home — Lease & Issue Agents

Full-stack service: an AI agent turns a lease into a verified lease record (Part A), another turns unit photos into a draft work order (Part B), both reviewed by a human and joined on the unit page.
Brief: `docs/attachments/Solution-brief-explained.docx` (summary in `docs/email.txt`). Plan: `docs/tasks/00-plan.md`.

## Commands
- `npm install` — install all workspaces
- `npm run dev` — API (8083) + web (3000)
- `npm test` — unit tests (Vitest)
- `npm run typecheck` — `tsc --noEmit` across workspaces
- `npm run samples:leases` — regenerate sample lease PDFs
(Keep this list in sync with `package.json` scripts.)

## Stack
- `apps/api` — Express 5 + TypeScript, Zod, multer, SQLite via Kysely behind repository interfaces (swap DB via `DATABASE_URL`)
- `apps/web` — Vite + React + TypeScript
- `packages/shared` — shared types and Zod schemas (single source of truth for API, agent output and UI)
- `data/` — `owner_ruleset.json`, `units.json`, sample leases and photos (+ `expected.json` ground truth)
- Model: OpenRouter (OpenAI SDK) behind a provider interface; stub provider when `OPENROUTER_API_KEY` is unset

## Code standards
**Simple, easy to debug, easy to maintain.** This code is read as the standard for a team — optimise for the next reader.
- Prefer plain functions and data over classes, patterns and abstractions. Add an abstraction only when there's a second real use (exceptions: the repository and model-provider interfaces, which exist for swapping).
- Small files with one job. Name things for what they mean in the domain (`lease`, `unit`, `workOrder`, `ruleResult`).
- TypeScript `strict`. No `any`; validate external input (HTTP bodies, model output, files) with Zod at the boundary, then trust the types inside.
- Pure logic (rules, date math, unit matching, quote checks) has no I/O, so it's trivially unit-testable.
- Errors: fail loudly with a clear message; never swallow. One Express error handler returns `{ error, details }`. Don't catch just to rethrow.
- Logging: one line per request and per model/tool call (what, inputs summary, duration, result). No secrets or full documents in logs.
- Comments explain *why*, not *what*. No commented-out code.
- No premature optimisation, caching or config options nobody asked for.

## Dependencies
Before adding a package, check it is **actively maintained** (release in the last ~6 months, issues answered), **widely used** (strong weekly downloads, many dependents) and **has types**. Prefer the standard library or a few lines of code over a package for small things. Record why each non-obvious dependency was chosen in README → Decisions.
Approved so far: express, zod, multer, kysely, better-sqlite3, openai, unpdf, mammoth, react, vite, vitest, pdfkit (dev).

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

## UI direction
- Reference: Claude Code's UI — chat-first, calm warm neutrals, one terracotta accent, sans for prose + mono for data/quotes, minimal chrome, collapsible step cards, light + dark.
- Inspired by, not a copy: no Anthropic/Claude logos, names or branding.
- Use `/impeccable` to shape, critique, audit and polish UI work.
- Accessibility basics: semantic HTML, keyboard reachable actions, visible focus, sufficient contrast.

## Dev environment
- Ports: web **3000**, API **8083**. Hostnames, CORS origin and Vite `allowedHosts` come from `.env` — never hardcode them.
- Machine-specific setup (private, gitignored): @docs/dev-env.md

## Repo & files
- Remote: `git@github.com:rem029/truelinks-ai-test.git` (branch `main`).
- `docs/`: only `docs/tasks/` and `docs/CLAUDE.md` are committed. The brief, email and attachments are private — never commit them.
- `CLAUDE.md` (root) → symlink to `docs/CLAUDE.md`. Edit the file in `docs/`.
- `.claude/` (root) → symlink to `docs/.claude/` (gitignored). Plugins are installed at user scope (Claude Code won't write settings through a symlinked `.claude`).
- Runtime files live outside `docs/` (e.g. `data/`). Secrets only in `.env` (gitignored); document every variable in `.env.example`.

## Workflow
- Tasks in `docs/tasks/NN-name.md`, split into phases; each phase has **Tasks** (checklist) and **Results** (what was done, decisions, follow-ups). Template: `docs/tasks/_template.md`. Update Results when a phase finishes.
- **`README.md` is the deliverable — keep it current in the same change.** Every feature, sample data, script, decision, trade-off, scale concern or product idea goes into README as we go, not at the end.
- Small, focused commits with a clear message saying what and why. Commit only when asked.
