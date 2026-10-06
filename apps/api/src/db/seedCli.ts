import { env } from '../env.ts';
import { createDb } from './db.ts';
import { migrateToLatest } from '../migrations/migrate.ts';
import { seed } from './seed.ts';
import { createRepositories } from './repositories/index.ts';
import { seedCurrentLeases } from '../services/leases/seedCurrentLeases.ts';

const db = createDb(env.DATABASE_URL);
try {
  await migrateToLatest(db);
  await seed(db);
  await seedCurrentLeases(createRepositories(db), env.UPLOAD_DIR);
} finally {
  await db.destroy();
}
