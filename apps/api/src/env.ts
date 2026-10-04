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

function resolveUploadDir(rawPath: string): string {
  return isAbsolute(rawPath) ? rawPath : resolve(REPO_ROOT, rawPath);
}

const envSchema = z.object({
  API_PORT: z
    .preprocess((val) => (val === '' || val === undefined ? undefined : val), z.coerce.number().int().min(1).max(65535))
    .default(8083),
  DATABASE_URL: z
    .string()
    .default('file:./var/app.db')
    .transform(resolveDatabaseUrl),
  UPLOAD_DIR: z
    .string()
    .default('./var/uploads')
    .transform(resolveUploadDir),
  OPENROUTER_API_KEY: z
    .preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), z.string().optional()),
  OPENROUTER_MODEL: z
    .preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), z.string().default('xiaomi/mimo-v2.6-pro')),
  OPENROUTER_FAST_MODEL: z
    .preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), z.string().default('google/gemini-3.5-flash-lite')),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
  throw new Error(`Invalid environment variables: ${issues}`);
}

export const env = result.data;
