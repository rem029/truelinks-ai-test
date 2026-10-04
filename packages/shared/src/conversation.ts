import { z } from 'zod';
import { Card } from './cards.ts';

export const ConversationKind = z.enum(['lease', 'issue']);
export type ConversationKind = z.infer<typeof ConversationKind>;

export const ConversationStatus = z.enum(['open', 'confirmed', 'abandoned']);
export type ConversationStatus = z.infer<typeof ConversationStatus>;

export const Conversation = z.object({
  id: z.string(),
  kind: ConversationKind,
  unitId: z.string().nullable(),
  status: ConversationStatus,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Conversation = z.infer<typeof Conversation>;

export const MessageRole = z.enum(['user', 'assistant', 'tool']);
export type MessageRole = z.infer<typeof MessageRole>;

export const Attachment = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
});
export type Attachment = z.infer<typeof Attachment>;

export const Message = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: MessageRole,
  text: z.string(),
  cards: z.array(Card),
  attachments: z.array(Attachment),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Message = z.infer<typeof Message>;
