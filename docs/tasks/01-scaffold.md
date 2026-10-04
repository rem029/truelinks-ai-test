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
- [ ] Verify via https://frontend.app.rem029.com:3000 and https://account.app.rem029.com:8083/api/health
- [ ] `packages/shared`: exported from source, used by both
### Results
-
