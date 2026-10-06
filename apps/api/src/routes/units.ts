import { Router } from 'express';
import { z } from 'zod';
import { NewUnit } from '@truelinks/shared';
import type { Repositories } from '../db/repositories/index.ts';
import { addUnit } from '../services/settings/addUnit.ts';
import { getUnitLeases } from '../services/units/getUnitLeases.ts';

const UnitParams = z.object({ unitId: z.string().min(1) });

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

  router.get('/units/:unitId/leases', async (req, res) => {
    const { unitId } = UnitParams.parse(req.params);
    res.json(await getUnitLeases(unitId, repositories));
  });

  return router;
}
