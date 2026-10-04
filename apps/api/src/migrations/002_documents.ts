import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export const migration002: Migration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable('documents')
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('conversation_id', 'text', (col) => col.notNull().references('conversations.id'))
      .addColumn('filename', 'text', (col) => col.notNull())
      .addColumn('mime_type', 'text', (col) => col.notNull())
      .addColumn('file_path', 'text', (col) => col.notNull())
      .addColumn('text_source', 'text', (col) => col.notNull().defaultTo('text'))
      .addColumn('clause_split', 'text', (col) => col.notNull().defaultTo('headings'))
      .addColumn('page_count', 'integer')
      .addColumn('clauses_json', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('documents').execute();
  },
};
