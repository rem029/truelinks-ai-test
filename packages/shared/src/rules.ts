import { z } from 'zod';
import { Severity } from './severity.js';

export const Rule = z.object({
  id: z.string(),
  description: z.string(),
  check: z.string(),
  severity: Severity,
});
export type Rule = z.infer<typeof Rule>;

export const Ruleset = z.object({
  name: z.string(),
  version: z.string(),
  rules: z.array(Rule),
});
export type Ruleset = z.infer<typeof Ruleset>;

export const RuleStatus = z.enum(['PASS', 'FAIL', 'NOT_DETERMINABLE']);
export type RuleStatus = z.infer<typeof RuleStatus>;

export const RuleResult = z.object({
  ruleId: z.string(),
  status: RuleStatus,
  reason: z.string(),
  clauseIds: z.array(z.string()),
  severity: Severity,
  rulesetVersion: z.string(),
});
export type RuleResult = z.infer<typeof RuleResult>;
