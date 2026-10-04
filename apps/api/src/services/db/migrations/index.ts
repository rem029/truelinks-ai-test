import type { Migration } from 'kysely/migration';
import { migration001 } from './001_init.js';

export const migrations: Record<string, Migration> = {
  '001_init': migration001,
};
