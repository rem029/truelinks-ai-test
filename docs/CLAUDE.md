# TrueLinks.AI take-home — Lease & Issue Agents

Brief: `docs/attachments/Solution-brief-explained.docx` (text summary in `docs/email.txt`).

## Stack
- `apps/api` — Express 5 + TypeScript, Zod, multer, SQLite via Kysely behind repository interfaces (DB swappable via `DATABASE_URL`)
- `apps/web` — Vite + React + TypeScript (minimal UI)
- `packages/shared` — shared types / Zod schemas
- `data/` — `owner_ruleset.json`, `units.json`, sample leases & photos
- Model: OpenRouter (OpenAI-compatible), behind a provider interface with a stub fallback when `OPENROUTER_API_KEY` is unset

## Dev environment (code-server)
- Runs on the user's code-server; HTTPS is terminated by the proxy in front.
- Web (Vite): port **3000** → https://frontend.app.rem029.com:3000
  - `server.host: true`, `server.port: 3000`, `strictPort: true`, `allowedHosts: ['frontend.app.rem029.com']`
- API (Express): port **8083** → https://account.app.rem029.com:8083
  - Listen on `0.0.0.0:8083`; CORS allow `https://frontend.app.rem029.com:3000`
- Web calls the API via `VITE_API_URL` (default `https://account.app.rem029.com:8083`).

## UI direction
- Reference: Claude Code's own UI — chat-first, calm warm-neutral palette, one warm accent (terracotta/orange), clean sans for prose + monospace for data/quotes, minimal chrome, collapsible tool/step cards, light + dark.
- Inspired by, not a copy: no Anthropic/Claude logos, names or branding.
- Use the `impeccable` skill (`/impeccable …`) for shaping, critique, audit and polish of UI work.

## Principles
- LLM extracts; deterministic code validates rules (R1–R7).
- Every extracted field carries its source (clause/quote).
- Human accepts/rejects each field, flag, and work order.
- Keep it minimal; note product ideas in README as we go.

## Repo & private files
- Remote: `git@github.com:rem029/truelinks-ai-test.git` (branch `main`).
- `docs/`: only `docs/tasks/` and `docs/CLAUDE.md` are committed (they show how the work was planned). The brief, email and attachments are private — never commit them.
- `CLAUDE.md` (root) → symlink to `docs/CLAUDE.md` (committed). Edit the file in `docs/`.
- `.claude/` (root) → symlink to `docs/.claude/` (gitignored). Plugins are installed at user scope because Claude Code won't write settings through a symlinked `.claude`.
- Anything the app needs at runtime must live outside `docs/` (e.g. `data/`).

## Workflow
- Work is tracked in `docs/tasks/`, one file per task: `NN-name.md`.
- Each task is split into phases; each phase has **Tasks** (checklist) and **Results** (what was done, decisions, follow-ups).
- Template: `docs/tasks/_template.md`.
- **Root `README.md` is the deliverable — keep it current as we go.** Whenever we add a feature, sample data, script, decision, trade-off, or product idea, record it in README.md in the same change (not at the end). `docs/` is private; anything reviewers need must be in README.
