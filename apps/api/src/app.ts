import express, { Router } from 'express';
import { requestLog } from './middleware/requestLog.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(requestLog);

  const apiRouter = Router();
  apiRouter.use(healthRouter);

  app.use('/api', apiRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
