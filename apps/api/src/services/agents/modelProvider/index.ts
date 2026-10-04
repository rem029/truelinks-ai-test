import type { ModelProvider } from './types.ts';
import { createStubProvider } from './stubProvider.ts';
import { createOpenRouterProvider } from './openRouterProvider.ts';

export * from './types.ts';

export interface CreateModelProviderOptions {
  apiKey?: string;
  model: string;
  fastModel: string;
}

export function createModelProvider(options: CreateModelProviderOptions): ModelProvider {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    console.log('Model provider: stub');
    return createStubProvider();
  }

  console.log(`Model provider: openrouter (default=${options.model}, fast=${options.fastModel})`);
  return createOpenRouterProvider({ apiKey, model: options.model, fastModel: options.fastModel });
}
