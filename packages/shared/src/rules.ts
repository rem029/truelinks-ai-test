import { z } from 'zod';
import { Severity } from './severity.ts';

// Lease fields an owner-added comparison rule can test; monthly rent is derived when the lease states another frequency
export const RULE_NUMBER_FIELDS = ['rent.monthly', 'rent.annual', 'deposit', 'termMonths'] as const;
export const RULE_BOOLEAN_FIELDS = ['landlord.signed', 'tenant.signed', 'escalation.isDefined'] as const;
export const RuleNumberField = z.enum(RULE_NUMBER_FIELDS);
export type RuleNumberField = z.infer<typeof RuleNumberField>;
export const RuleBooleanField = z.enum(RULE_BOOLEAN_FIELDS);
export type RuleBooleanField = z.infer<typeof RuleBooleanField>;

export const RuleOperator = z.enum(['<', '<=', '>', '>=', '=', '!=']);
export type RuleOperator = z.infer<typeof RuleOperator>;

// "deposit >= 15000", "deposit >= 2 × rent.monthly" or "tenant.signed = true"
export const RuleComparison = z.discriminatedUnion('type', [
  z.object({ type: z.literal('number'), field: RuleNumberField, operator: RuleOperator, value: z.number() }),
  z.object({
    type: z.literal('field'),
    field: RuleNumberField,
    operator: RuleOperator,
    otherField: RuleNumberField,
    factor: z.number().positive(),
  }),
  z.object({ type: z.literal('boolean'), field: RuleBooleanField, operator: z.enum(['=', '!=']), value: z.boolean() }),
]);
export type RuleComparison = z.infer<typeof RuleComparison>;

// builtin: R1–R7, checked by hand-written code; comparison: checked by code from `comparison`;
// ai: a plain-language rule the background analysis judges, with a quote code verifies
export const RuleKind = z.enum(['builtin', 'comparison', 'ai']);
export type RuleKind = z.infer<typeof RuleKind>;

export const Rule = z.object({
  id: z.string(),
  description: z.string(),
  check: z.string(),
  severity: Severity,
  kind: RuleKind.default('builtin'),
  comparison: RuleComparison.optional(),
});
export type Rule = z.infer<typeof Rule>;

export const Ruleset = z.object({
  name: z.string(),
  version: z.string(),
  rules: z.array(Rule),
});
export type Ruleset = z.infer<typeof Ruleset>;

// One saved version in the history, newest first
export const RulesetVersion = Ruleset.extend({
  createdAt: z.string(),
  // "Added R8", "Edited R8", "Deleted R3", "Restored version 1.1"; empty for the version imported from the owner's file
  changeNote: z.string(),
});
export type RulesetVersion = z.infer<typeof RulesetVersion>;

// What an owner can change on a rule; built-in rules (R1–R7) only take a new severity
export const RuleEdit = z
  .object({
    description: z.string().trim().min(3).max(500).optional(),
    severity: Severity.optional(),
    comparison: RuleComparison.optional(),
  })
  .strict();
export type RuleEdit = z.infer<typeof RuleEdit>;

export const NewRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('comparison'), description: z.string().trim().min(3).max(300), severity: Severity, comparison: RuleComparison }),
  z.object({ kind: z.literal('ai'), description: z.string().trim().min(10).max(500), severity: Severity }),
]);
export type NewRule = z.infer<typeof NewRule>;

export const RuleStatus = z.enum(['PASS', 'FAIL', 'NOT_DETERMINABLE']);
export type RuleStatus = z.infer<typeof RuleStatus>;

export const RuleResult = z.object({
  ruleId: z.string(),
  status: RuleStatus,
  reason: z.string(),
  clauseIds: z.array(z.string()),
  severity: Severity,
  rulesetVersion: z.string(),
  // Who decided: code (rules R1–R7 and comparisons) or the model (plain-language rules)
  checkedBy: z.enum(['code', 'ai']).default('code'),
});
export type RuleResult = z.infer<typeof RuleResult>;
