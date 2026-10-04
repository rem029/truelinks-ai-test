import type { LeaseRecord, RuleResult, Flag } from '@truelinks/shared';
import type { Repositories } from '../db/repositories/index.js';
import { matchUnit, type UnitMatch } from './unitMatch.js';
import { evaluateRules } from './rules.js';
import { detectFlags } from './flags.js';

export interface EvaluateLeaseInput {
  record: LeaseRecord;
  pageUnitId?: string | null;
}

export interface EvaluateLeaseResult {
  unitMatch: UnitMatch;
  ruleResults: RuleResult[];
  flags: Flag[];
  rulesetVersion: string;
}

export async function evaluateLease(
  input: EvaluateLeaseInput,
  repos: Pick<Repositories, 'rulesets' | 'units'>
): Promise<EvaluateLeaseResult> {
  const startTime = Date.now();

  const ruleset = await repos.rulesets.getLatest();
  if (!ruleset) {
    throw new Error('No ruleset found in database; please ensure migrations and seed have run');
  }

  const units = await repos.units.list();
  const unitMatch = matchUnit(input.record, units, input.pageUnitId);
  const ruleResults = evaluateRules({
    record: input.record,
    unitMatch,
    ruleset,
  });
  const flags = detectFlags({
    record: input.record,
    unitMatch,
    pageUnitId: input.pageUnitId,
  });

  const passCount = ruleResults.filter((r) => r.status === 'PASS').length;
  const failCount = ruleResults.filter((r) => r.status === 'FAIL').length;
  const ndCount = ruleResults.filter((r) => r.status === 'NOT_DETERMINABLE').length;
  const durationMs = Date.now() - startTime;

  console.log(
    `lease evaluate ruleset=${ruleset.version} unit=${unitMatch.status} rules=${passCount} PASS/${failCount} FAIL/${ndCount} ND flags=${flags.length} ${durationMs}ms`
  );

  return {
    unitMatch,
    ruleResults,
    flags,
    rulesetVersion: ruleset.version,
  };
}
