# 10 — Migration backup · Stretch 7

Goal: a failed migration never leaves the database half-changed; the owner's data is restored automatically.

Why: migrations run on API start (`server.ts` → `migrateToLatest`) and in `npm run db:seed`. Kysely's SQLite adapter reports `supportsTransactionalDdl = false`, so migrations don't run in a transaction. A migration that fails halfway leaves the schema and data half-changed.

## Phase 1 — Backup, migrate, restore
### Tasks
- [ ] `migrations/migrateWithBackup.ts`: `migrateWithBackup(databaseUrl) → Kysely<Database>`
  - `file::memory:`, or no database file yet → just migrate (nothing to protect)
  - No pending migration → no backup (don't copy the database on every start)
  - Pending migration → snapshot with `VACUUM INTO '<db>.backup-<timestamp>'` (consistent in WAL mode) → `migrateToLatest`
  - Success → delete the backup; log `db migrated applied=<names> backup=deleted`
  - Failure → `db.destroy()`, copy the backup over the database file, delete `-wal`/`-shm`, keep the backup file, log `db migration failed, restored backup path=… reason=…`, throw an error naming the backup; if the restore itself fails, throw with both reasons and the backup path
- [ ] `server.ts` and `seedCli.ts` call `migrateWithBackup` instead of `createDb` + `migrateToLatest`
- [ ] `.gitignore`: `*.db.backup-*`
- [ ] Tests (temp dir): new file → no backup left; up-to-date database → no backup made; failing migration → earlier data intact, backup kept, error names it; succeeding migration → applied, backup deleted
- [ ] README: one sentence under "Run it", plus a Decisions bullet (migrate on start for a one-command setup; backup because SQLite DDL isn't transactional in Kysely; in production, migrations are a separate deploy step before new instances start)
- [ ] Decide: delete the backup on success (owner's spec) or keep the latest one, in case a migration "succeeds" but damages data
- [ ] Optional: `npm run db:migrate` (migrations only, no seed) as the production-style separate step
### Results
-
