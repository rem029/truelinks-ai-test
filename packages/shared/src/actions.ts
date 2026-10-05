import { z } from 'zod';

export const ActionType = z.enum(['accept', 'reject', 'edit', 'choose', 'confirm', 'acceptAll']);
export type ActionType = z.infer<typeof ActionType>;

export const AcceptAction = z.object({
  type: z.literal('accept'),
  cardId: z.string(),
});
export type AcceptAction = z.infer<typeof AcceptAction>;

export const RejectAction = z.object({
  type: z.literal('reject'),
  cardId: z.string(),
  reason: z.string().optional(),
});
export type RejectAction = z.infer<typeof RejectAction>;

export const EditAction = z.object({
  type: z.literal('edit'),
  cardId: z.string(),
  value: z.unknown(),
});
export type EditAction = z.infer<typeof EditAction>;

export const ChooseAction = z.object({
  type: z.literal('choose'),
  cardId: z.string(),
  option: z.string(),
});
export type ChooseAction = z.infer<typeof ChooseAction>;

export const ConfirmAction = z.object({
  type: z.literal('confirm'),
  conversationId: z.string(),
  overrideReason: z.string().optional(),
});
export type ConfirmAction = z.infer<typeof ConfirmAction>;

export const AcceptAllAction = z.object({
  type: z.literal('acceptAll'),
});
export type AcceptAllAction = z.infer<typeof AcceptAllAction>;

export const Action = z.discriminatedUnion('type', [
  AcceptAction,
  RejectAction,
  EditAction,
  ChooseAction,
  ConfirmAction,
  AcceptAllAction,
]);
export type Action = z.infer<typeof Action>;
