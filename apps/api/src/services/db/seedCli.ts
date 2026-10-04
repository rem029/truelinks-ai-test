import { env } from '../../env.ts';
import { createDb } from './db.ts';
import { migrateToLatest } from '../../migrations/migrate.ts';
import { seed } from './seed.ts';

const db = createDb(env.DATABASE_URL);
try {
  await migrateToLatest(db);
  await seed(db);
} finally {
  await db.destroy();
}
