# 01 — Scaffold

Goal: `npm install && npm run dev` starts API + web, web calls API.

## Phase 1 — Workspace
### Tasks
- [ ] Root `tsconfig.base.json`, dev deps (typescript, tsx, vitest, concurrently)
- [ ] Root scripts: `dev`, `test`, `typecheck`
### Results
-

## Phase 2 — Apps
### Tasks
- [ ] `apps/api`: Express 5 on `0.0.0.0:8083`, CORS for web origin, `/api/health`, dotenv, error handler
- [ ] `apps/web`: Vite + React + TS on port 3000, `allowedHosts`, `VITE_API_URL`
- [ ] Hosts/origins from `.env`; verify web + `/api/health` on the dev URLs in `docs/dev-env.md`
- [ ] `packages/shared`: exported from source, used by both
### Results
-
