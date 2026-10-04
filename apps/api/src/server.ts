import { createApp } from './app.ts';
import { env } from './env.ts';
import { createDb } from './services/db/db.ts';
import { migrateToLatest } from './migrations/migrate.ts';
import { seed } from './services/db/seed.ts';
import { createRepositories } from './services/db/repositories/index.ts';
import { createModelProvider } from './services/agents/modelProvider/index.ts';

const db = createDb(env.DATABASE_URL);
await migrateToLatest(db);
await seed(db);

const repositories = createRepositories(db);
const modelProvider = createModelProvider({
  apiKey: env.OPENROUTER_API_KEY,
  model: env.OPENROUTER_MODEL,
  fastModel: env.OPENROUTER_FAST_MODEL,
});
const app = createApp({ repositories, modelProvider, uploadDir: env.UPLOAD_DIR });


app.listen(env.API_PORT, '0.0.0.0', () => {
  console.log(`API listening on http://0.0.0.0:${env.API_PORT}`);
});
