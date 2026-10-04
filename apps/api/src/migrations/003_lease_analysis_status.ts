import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export const migration003: Migration = {
  async up(db: Kysely<unknown>): Promise<void> {
    // Leases saved before the background analysis existed have nothing pending
    await db.schema
      .alterTable('leases')
      .addColumn('analysis_status', 'text', (col) => col.notNull().defaultTo('done'))
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('leases').dropColumn('analysis_status').execute();
  },
};
