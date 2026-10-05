import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export const migration005: Migration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable('work_orders')
      .addColumn('responsibility_reason', 'text', (col) => col.notNull().defaultTo(''))
      .execute();

    await db.schema
      .alterTable('work_orders')
      .addColumn('responsibility_clause_json', 'text')
      .execute();

    await db.schema
      .alterTable('work_orders')
      .addColumn('lease_id', 'text')
      .execute();

    await db.schema
      .alterTable('work_orders')
      .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(''))
      .execute();

    await db.schema
      .createIndex('idx_work_orders_issue')
      .on('work_orders')
      .column('issue_id')
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropIndex('idx_work_orders_issue').execute();
    await db.schema.alterTable('work_orders').dropColumn('updated_at').execute();
    await db.schema.alterTable('work_orders').dropColumn('lease_id').execute();
    await db.schema.alterTable('work_orders').dropColumn('responsibility_clause_json').execute();
    await db.schema.alterTable('work_orders').dropColumn('responsibility_reason').execute();
  },
};
