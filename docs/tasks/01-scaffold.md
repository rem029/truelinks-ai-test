# 01 — Scaffold

Goal: `npm install && npm run dev` starts API + web, web calls API.

## Phase 1 — Workspace
### Tasks
- [x] Root `tsconfig.base.json`, dev deps (typescript, tsx, vitest, concurrently)
- [x] Root scripts: `dev`, `test`, `typecheck`
### Results
- npm workspaces `@truelinks/api`, `@truelinks/web`, `@truelinks/shared`. Strict TS (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, Bundler resolution, noEmit). TypeScript 7, Vitest 5, tsx, concurrently.
- `npm run dev` runs both apps via concurrently; `npm test` = `vitest run` at root; `typecheck` runs `tsc --noEmit` in each workspace.

## Phase 2 — Apps
### Tasks
- [x] `apps/api`: Express 5 on `0.0.0.0:8083`, `/api/health`, env loading, error handler, request log
- [x] `apps/web`: Vite + React + TS on port 3000, `allowedHosts` from env, `/api` proxy
- [x] Hosts from `.env`; verified web + `/api/health` on the dev URLs in `docs/dev-env.md`
- [x] `packages/shared`: exported from source, used by both (`HealthResponse` schema)
### Results
- **Changed from plan:** no CORS and no `VITE_API_URL` — the web calls same-origin `/api`, proxied by Vite to the API. Fewer moving parts; works on localhost and behind the dev proxy. Env: `API_PORT`, `WEB_ALLOWED_HOSTS` (in `.env.example`).
- No dotenv: `process.loadEnvFile` (Node 24) + Zod validation in `apps/api/src/env.ts`.
- API: `createApp()` (no listen, testable), one-line request log, single error handler (`ZodError` → 400 with issues, else 500 + stack logged), JSON 404 under `/api`.
- Tests: `apps/api/src/app.test.ts` (health validates against the shared schema; unknown route → 404 JSON). typecheck + 2 tests pass.
- Verified: localhost:8083 and :3000/api/health → `{"status":"ok"}`; dev URLs (HTTPS on 443, no port) load the page showing "API: ok", no console errors.
- Default model switched to `xiaomi/mimo-v2.6-pro` (cheap, vision + tools + JSON) in `.env.example`.
- Seed: nothing to seed yet (DB arrives in 02).
