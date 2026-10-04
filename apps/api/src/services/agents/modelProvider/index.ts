import type { ModelProvider } from './types.js';
import { createStubProvider } from './stubProvider.js';
import { createOpenRouterProvider } from './openRouterProvider.js';

export * from './types.js';

export interface CreateModelProviderOptions {
  apiKey?: string;
  model: string;
}

export function createModelProvider(options: CreateModelProviderOptions): ModelProvider {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    console.log('Model provider: stub');
    return createStubProvider();
  }

  console.log(`Model provider: openrouter (${options.model})`);
  return createOpenRouterProvider({ apiKey, model: options.model });
}
