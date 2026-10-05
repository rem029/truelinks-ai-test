import { describe, it, expect } from 'vitest';
import { createDb } from './db.ts';

describe('createDb', () => {
  it('creates an in-memory database instance with file::memory:', async () => {
    const db = createDb('file::memory:');
    expect(db).toBeDefined();
    await db.destroy();
  });

  it('throws clear error when file path is empty', () => {
    expect(() => createDb('file:')).toThrow('Database path cannot be empty');
  });

  it('throws clear error on postgres:// scheme', () => {
    expect(() => createDb('postgres://localhost:5432/mydb')).toThrow(
      'Postgres not wired yet: add pg + PostgresDialect here'
    );
  });

  it('throws error on unsupported scheme', () => {
    expect(() => createDb('mysql://localhost:3306/mydb')).toThrow(
      'Unsupported database URL: mysql://localhost:3306/mydb'
    );
  });
});
