import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';

export const REPO_ROOT = resolve(import.meta.dirname, '../../..');

const repoRootEnv = resolve(REPO_ROOT, '.env');
if (existsSync(repoRootEnv)) {
  process.loadEnvFile(repoRootEnv);
}

function resolveDatabaseUrl(rawUrl: string): string {
  if (!rawUrl.startsWith('file:')) {
    return rawUrl;
  }
  const filePath = rawUrl.slice('file:'.length);
  if (filePath === ':memory:') {
    return rawUrl;
  }
  const resolvedPath = isAbsolute(filePath) ? filePath : resolve(REPO_ROOT, filePath);
  return `file:${resolvedPath}`;
}

const envSchema = z.object({
  API_PORT: z
    .preprocess((val) => (val === '' || val === undefined ? undefined : val), z.coerce.number().int().min(1).max(65535))
    .default(8083),
  DATABASE_URL: z
    .string()
    .default('file:./var/app.db')
    .transform(resolveDatabaseUrl),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
  throw new Error(`Invalid environment variables: ${issues}`);
}

export const env = result.data;
