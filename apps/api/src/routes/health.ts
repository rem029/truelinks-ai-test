import { Router } from 'express';
import type { HealthResponse } from '@truelinks/shared';
import type { ModelProvider } from '../services/agents/modelProvider/types.js';

export function createHealthRouter(provider: ModelProvider) {
  const healthRouter = Router();

  healthRouter.get('/health', (_req, res) => {
    const response: HealthResponse = {
      status: 'ok',
      modelProvider: provider.name,
    };
    res.json(response);
  });

  return healthRouter;
}
