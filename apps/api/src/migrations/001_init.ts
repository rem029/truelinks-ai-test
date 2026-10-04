import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export const migration001: Migration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable('units')
      .addColumn('unit_id', 'text', (col) => col.primaryKey())
      .addColumn('label', 'text', (col) => col.notNull())
      .addColumn('type', 'text', (col) => col.notNull())
      .addColumn('area_sqm', 'real', (col) => col.notNull())
      .addColumn('parking_bay', 'text', (col) => col.notNull())
      .addColumn('status', 'text', (col) => col.notNull())
      .addColumn('building_id', 'text', (col) => col.notNull())
      .addColumn('building_name', 'text', (col) => col.notNull())
      .addColumn('property_id', 'text', (col) => col.notNull())
      .addColumn('property_name', 'text', (col) => col.notNull())
      .execute();

    await db.schema
      .createTable('rulesets')
      .addColumn('version', 'text', (col) => col.primaryKey())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('rules_json', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();

    await db.schema
      .createTable('conversations')
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('kind', 'text', (col) => col.notNull())
      .addColumn('unit_id', 'text', (col) => col.references('units.unit_id'))
      .addColumn('status', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .execute();

    await db.schema
      .createTable('messages')
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('conversation_id', 'text', (col) => col.notNull().references('conversations.id'))
      .addColumn('role', 'text', (col) => col.notNull())
      .addColumn('text', 'text', (col) => col.notNull())
      .addColumn('cards_json', 'text', (col) => col.notNull())
      .addColumn('attachments_json', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();

    await db.schema
      .createTable('leases')
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('conversation_id', 'text', (col) => col.notNull().references('conversations.id'))
      .addColumn('unit_id', 'text', (col) => col.references('units.unit_id'))
      .addColumn('record_json', 'text', (col) => col.notNull())
      .addColumn('flags_json', 'text', (col) => col.notNull())
      .addColumn('rule_results_json', 'text', (col) => col.notNull())
      .addColumn('ruleset_version', 'text', (col) => col.notNull())
      .addColumn('status', 'text', (col) => col.notNull())
      .addColumn('override_reason', 'text')
      .addColumn('confirmed_at', 'text')
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .execute();

    await db.schema
      .createTable('issues')
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('unit_id', 'text', (col) => col.notNull().references('units.unit_id'))
      .addColumn('conversation_id', 'text', (col) => col.notNull().references('conversations.id'))
      .addColumn('reporter_role', 'text', (col) => col.notNull())
      .addColumn('note', 'text')
      .addColumn('photos_json', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();

    await db.schema
      .createTable('work_orders')
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('issue_id', 'text', (col) => col.notNull().references('issues.id'))
      .addColumn('unit_id', 'text', (col) => col.notNull().references('units.unit_id'))
      .addColumn('title', 'text', (col) => col.notNull())
      .addColumn('description', 'text', (col) => col.notNull())
      .addColumn('category', 'text', (col) => col.notNull())
      .addColumn('severity', 'text', (col) => col.notNull())
      .addColumn('urgent', 'integer', (col) => col.notNull())
      .addColumn('responsibility', 'text', (col) => col.notNull())
      .addColumn('status', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('work_orders').execute();
    await db.schema.dropTable('issues').execute();
    await db.schema.dropTable('leases').execute();
    await db.schema.dropTable('messages').execute();
    await db.schema.dropTable('conversations').execute();
    await db.schema.dropTable('rulesets').execute();
    await db.schema.dropTable('units').execute();
  },
};
