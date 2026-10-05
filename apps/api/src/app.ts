import express, { Router } from 'express';
import { requestLog } from './middleware/requestLog.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { createHealthRouter } from './routes/health.ts';
import { createUnitsRouter } from './routes/units.ts';
import { createConversationsRouter } from './routes/conversations.ts';
import { createDocumentsRouter } from './routes/documents.ts';
import { createIssuesRouter } from './routes/issues.ts';
import type { Repositories } from './services/db/repositories/index.ts';
import type { ModelProvider } from './services/agents/modelProvider/types.ts';

export interface AppDependencies {
  repositories: Repositories;
  modelProvider: ModelProvider;
  uploadDir: string;
}

export function createApp(deps: AppDependencies) {
  const app = express();

  app.use(express.json());
  app.use(requestLog);

  const apiRouter = Router();
  apiRouter.use(createHealthRouter(deps.modelProvider));
  apiRouter.use(createUnitsRouter(deps.repositories.units));
  apiRouter.use(createConversationsRouter(deps.repositories, deps.uploadDir, deps.modelProvider));
  apiRouter.use(createIssuesRouter(deps.repositories, deps.uploadDir, deps.modelProvider));
  apiRouter.use(createDocumentsRouter(deps.repositories, deps.uploadDir));

  app.use('/api', apiRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
