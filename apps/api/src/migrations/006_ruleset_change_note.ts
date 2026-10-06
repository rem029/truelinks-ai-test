import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Each ruleset version says what changed ("Added R8", "Restored version 1.1"), so the history reads without diffing
export const migration006: Migration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable('rulesets')
      .addColumn('change_note', 'text', (col) => col.notNull().defaultTo(''))
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('rulesets').dropColumn('change_note').execute();
  },
};
