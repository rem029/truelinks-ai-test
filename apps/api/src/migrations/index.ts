import type { Migration } from 'kysely/migration';
import { migration001 } from './001_init.ts';
import { migration002 } from './002_documents.ts';
import { migration003 } from './003_lease_analysis_status.ts';
import { migration004 } from './004_review_loop.ts';
import { migration005 } from './005_work_order_responsibility.ts';

export const migrations: Record<string, Migration> = {
  '001_init': migration001,
  '002_documents': migration002,
  '003_lease_analysis_status': migration003,
  '004_review_loop': migration004,
  '005_work_order_responsibility': migration005,
};

