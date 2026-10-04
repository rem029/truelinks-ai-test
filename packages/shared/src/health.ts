import { z } from 'zod';

export const ModelProviderName = z.enum(['stub', 'openrouter']);
export type ModelProviderName = z.infer<typeof ModelProviderName>;

export const HealthResponse = z.object({
  status: z.literal('ok'),
  modelProvider: ModelProviderName,
});

export type HealthResponse = z.infer<typeof HealthResponse>;

