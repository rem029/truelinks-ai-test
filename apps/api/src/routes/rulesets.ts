import { Router } from 'express';
import { NewRule, RuleEdit } from '@truelinks/shared';
import type { Repositories } from '../db/repositories/index.ts';
import { HttpError } from '../utils/httpError.ts';
import { addRule, deleteRule, editRule, restoreVersion } from '../services/settings/rulesetChanges.ts';

// Every change answers with the new current version
export function createRulesetsRouter(repositories: Repositories): Router {
  const router = Router();

  router.get('/rulesets', async (_req, res) => {
    res.json(await repositories.rulesets.listVersions());
  });

  router.get('/rulesets/current', async (_req, res) => {
    const ruleset = await repositories.rulesets.getLatest();
    if (!ruleset) {
      throw new HttpError(404, 'No ruleset found');
    }
    res.json(ruleset);
  });

  router.post('/rulesets/current/rules', async (req, res) => {
    res.status(201).json(await addRule(NewRule.parse(req.body), repositories));
  });

  router.patch('/rulesets/current/rules/:ruleId', async (req, res) => {
    res.json(await editRule(req.params.ruleId, RuleEdit.parse(req.body), repositories));
  });

  router.delete('/rulesets/current/rules/:ruleId', async (req, res) => {
    res.json(await deleteRule(req.params.ruleId, repositories));
  });

  router.post('/rulesets/:version/restore', async (req, res) => {
    res.status(201).json(await restoreVersion(req.params.version, repositories));
  });

  return router;
}
