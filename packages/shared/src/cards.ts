import { z } from 'zod';
import { sourcedField } from './sourcedField.js';
import { RuleResult } from './rules.js';
import { Flag } from './flag.js';
import { Unit } from './unit.js';
import { WorkOrder } from './issue.js';
import { ActionType } from './actions.js';

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
});
export type SummaryCard = z.infer<typeof SummaryCard>;

export const Card = z.discriminatedUnion('type', [
  FieldCard,
  RuleCard,
  FlagCard,
  UnitMatchCard,
  WorkOrderCard,
  SummaryCard,
]);
export type Card = z.infer<typeof Card>;

export const ALLOWED_ACTIONS = {
  field: ['accept', 'reject', 'edit'],
  rule: ['accept'],
  flag: ['accept', 'reject'],
  unitMatch: ['choose'],
  workOrder: ['accept', 'reject', 'edit'],
  summary: ['confirm'],
} as const satisfies Record<Card['type'], readonly ActionType[]>;

export type AllowedActionsMap = typeof ALLOWED_ACTIONS;
export type CardType = Card['type'];
