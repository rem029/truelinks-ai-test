import { createApp } from './app.js';
import { env } from './env.js';
import { createDb } from './services/db/db.js';
import { migrateToLatest } from './services/db/migrations/migrate.js';
import { seed } from './services/db/seed.js';
import { createRepositories } from './services/db/repositories/index.js';

const db = createDb(env.DATABASE_URL);
await migrateToLatest(db);
await seed(db);

const repositories = createRepositories(db);
const app = createApp({ repositories });

app.listen(env.API_PORT, '0.0.0.0', () => {
  console.log(`API listening on http://0.0.0.0:${env.API_PORT}`);
});
