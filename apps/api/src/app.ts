import express, { Router } from 'express';
import { requestLog } from './middleware/requestLog.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createHealthRouter } from './routes/health.js';
import { createUnitsRouter } from './routes/units.js';
import type { Repositories } from './services/db/repositories/index.js';
import type { ModelProvider } from './services/agents/modelProvider/types.js';

export interface AppDependencies {
  repositories: Repositories;
  modelProvider: ModelProvider;
}

export function createApp(deps: AppDependencies) {
  const app = express();

  app.use(express.json());
  app.use(requestLog);

  const apiRouter = Router();
  apiRouter.use(createHealthRouter(deps.modelProvider));
  apiRouter.use(createUnitsRouter(deps.repositories.units));

  app.use('/api', apiRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
