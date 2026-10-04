import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Database as DatabaseSchema } from './schema.js';

export function createDb(databaseUrl: string): Kysely<DatabaseSchema> {
  if (databaseUrl.startsWith('postgres://')) {
    // Repositories and migrations are written to be portable SQL, ready for PostgresDialect
    throw new Error('Postgres not wired yet: add pg + PostgresDialect here');
  }

  if (databaseUrl.startsWith('file:')) {
    const rawPath = databaseUrl.slice('file:'.length);
    if (rawPath === '') {
      throw new Error('Database path cannot be empty');
    }

    let sqlite: Database.Database;
    if (rawPath === ':memory:') {
      sqlite = new Database(':memory:');
    } else {
      mkdirSync(dirname(rawPath), { recursive: true });
      sqlite = new Database(rawPath);
    }

    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    return new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: sqlite,
      }),
    });
  }

  throw new Error(`Unsupported database URL: ${databaseUrl}`);
}
