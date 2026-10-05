import { Migrator, type MigrationProvider } from 'kysely/migration';
import type { Kysely } from 'kysely';
import { migrations } from './index.ts';
import type { Database } from '../db/schema.ts';

export const staticMigrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: staticMigrationProvider,
  });

  const { error, results } = await migrator.migrateToLatest();
  if (error) {
    throw error;
  }
  const failed = results?.find((r) => r.status === 'Error');
  if (failed) {
    throw new Error(`Migration ${failed.migrationName} failed`);
  }
}
