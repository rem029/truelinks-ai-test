import { env } from '../../env.js';
import { createDb } from './db.js';
import { migrateToLatest } from './migrations/migrate.js';
import { seed } from './seed.js';

const db = createDb(env.DATABASE_URL);
try {
  await migrateToLatest(db);
  await seed(db);
} finally {
  await db.destroy();
}
