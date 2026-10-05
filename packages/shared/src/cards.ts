import { z } from 'zod';
import { sourcedField } from './sourcedField.ts';
import { RuleResult } from './rules.ts';
import { Flag } from './flag.ts';
import { Unit } from './unit.ts';
import { WorkOrder, IssuePhoto } from './issue.ts';
import { ActionType } from './actions.ts';

export const FieldCard = z.object({
  id: z.string(),
  type: z.literal('field'),
  fieldPath: z.string(),
  field: sourcedField(z.unknown()),
});
export type FieldCard = z.infer<typeof FieldCard>;

export const RuleCard = z.object({
  id: z.string(),
  type: z.literal('rule'),
  result: RuleResult,
});
export type RuleCard = z.infer<typeof RuleCard>;

export const FlagCard = z.object({
  id: z.string(),
  type: z.literal('flag'),
  flag: Flag,
});
export type FlagCard = z.infer<typeof FlagCard>;

export const UnitMatchCard = z.object({
  id: z.string(),
  type: z.literal('unitMatch'),
  candidates: z.array(Unit),
  chosenUnitId: z.string().nullable(),
  reason: z.string(),
});
export type UnitMatchCard = z.infer<typeof UnitMatchCard>;

export const WorkOrderCard = z.object({
  id: z.string(),
  type: z.literal('workOrder'),
  workOrder: WorkOrder,
});
export type WorkOrderCard = z.infer<typeof WorkOrderCard>;

export const SummaryCard = z.object({
  id: z.string(),
  type: z.literal('summary'),
  title: z.string(),
  lines: z.array(z.string()),
  acceptAllCount: z.number().int().nonnegative().optional(),
});
export type SummaryCard = z.infer<typeof SummaryCard>;

export const ConditionCard = z.object({
  id: z.string(),
  type: z.literal('condition'),
  photos: z.array(IssuePhoto),
});
export type ConditionCard = z.infer<typeof ConditionCard>;

export const Card = z.discriminatedUnion('type', [
  FieldCard,
  RuleCard,
  FlagCard,
  UnitMatchCard,
  WorkOrderCard,
  SummaryCard,
  ConditionCard,
]);
export type Card = z.infer<typeof Card>;

export const ALLOWED_ACTIONS = {
  field: ['accept', 'reject', 'edit'],
  rule: [],
  flag: ['accept', 'reject'],
  unitMatch: ['choose'],
  workOrder: ['accept', 'reject', 'edit'],
  summary: ['confirm', 'acceptAll'],
  condition: [],
} as const satisfies Record<Card['type'], readonly ActionType[]>;

export type AllowedActionsMap = typeof ALLOWED_ACTIONS;
export type CardType = Card['type'];
