import { Router } from 'express';
import type { HealthResponse } from '@truelinks/shared';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const response: HealthResponse = { status: 'ok' };
  res.json(response);
});
