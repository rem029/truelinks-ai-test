import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const repoRootEnv = resolve(import.meta.dirname, '../../../.env');
if (existsSync(repoRootEnv)) {
  process.loadEnvFile(repoRootEnv);
}

const envSchema = z.object({
  API_PORT: z
    .preprocess((val) => (val === '' || val === undefined ? undefined : val), z.coerce.number().int().min(1).max(65535))
    .default(8083),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
  throw new Error(`Invalid environment variables: ${issues}`);
}

export const env = result.data;
