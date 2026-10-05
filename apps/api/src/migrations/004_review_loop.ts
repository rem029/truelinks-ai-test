import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export const migration004: Migration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable('messages')
      .addColumn('tool_calls_json', 'text')
      .execute();

    await db.schema
      .createIndex('idx_messages_conversation_created')
      .on('messages')
      .columns(['conversation_id', 'created_at'])
      .execute();

    await db.schema
      .createIndex('idx_leases_unit')
      .on('leases')
      .column('unit_id')
      .execute();

    await db.schema
      .createIndex('idx_issues_unit')
      .on('issues')
      .column('unit_id')
      .execute();

    await db.schema
      .createIndex('idx_work_orders_unit')
      .on('work_orders')
      .column('unit_id')
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropIndex('idx_work_orders_unit').execute();
    await db.schema.dropIndex('idx_issues_unit').execute();
    await db.schema.dropIndex('idx_leases_unit').execute();
    await db.schema.dropIndex('idx_messages_conversation_created').execute();
    await db.schema.alterTable('messages').dropColumn('tool_calls_json').execute();
  },
};
