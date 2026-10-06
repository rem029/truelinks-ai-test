import { Router } from 'express';
import { NewUnit } from '@truelinks/shared';
import type { Repositories } from '../db/repositories/index.ts';
import { addUnit } from '../services/settings/addUnit.ts';

export function createUnitsRouter(repositories: Repositories): Router {
  const router = Router();

  router.get('/units', async (_req, res) => {
    const units = await repositories.units.list();
    res.json(units);
  });

  router.post('/units', async (req, res) => {
    const input = NewUnit.parse(req.body);
    const unit = await addUnit(input, repositories);
    res.status(201).json(unit);
  });

  return router;
}
