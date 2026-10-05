import { Router } from 'express';
import type { UnitRepository } from '../db/repositories/unitRepository.ts';

export function createUnitsRouter(unitRepository: UnitRepository): Router {
  const router = Router();

  router.get('/units', async (_req, res) => {
    const units = await unitRepository.list();
    res.json(units);
  });

  return router;
}
