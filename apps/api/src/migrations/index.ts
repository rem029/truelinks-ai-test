import type { Migration } from 'kysely/migration';
import { migration001 } from './001_init.ts';
import { migration002 } from './002_documents.ts';
export const migrations: Record<string, Migration> = {
  '001_init': migration001,
  '002_documents': migration002,
};

