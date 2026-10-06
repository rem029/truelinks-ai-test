import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Archiving is separate from status, so unarchiving brings a review back exactly as it was (draft or confirmed)
export const migration007: Migration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('conversations').addColumn('archived_at', 'text').execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('conversations').dropColumn('archived_at').execute();
  },
};
