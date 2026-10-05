import type { LeaseDocument, LeaseRecord, RuleResult, Flag } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { matchUnit, type UnitMatch } from './unitMatch.ts';
import { evaluateRules } from './rules.ts';
import { detectFlags } from './flags.ts';

export interface EvaluateLeaseInput {
  record: LeaseRecord;
  pageUnitId?: string | null;
  document?: Pick<LeaseDocument, 'textSource' | 'clauseSplit'>;
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
    document: input.document,
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
