import type { Conversation, Message, LeaseDocument } from '@truelinks/shared';
import type { Repositories } from '../db/repositories/index.ts';
import { HttpError } from '../../utils/httpError.ts';

export interface ConversationDetails {
  conversation: Conversation;
  messages: Message[];
  documents: LeaseDocument[];
}

export async function getConversation(
  id: string,
  repositories: Repositories
): Promise<ConversationDetails> {
  const conversation = await repositories.conversations.get(id);
  if (!conversation) {
    throw new HttpError(404, `Conversation ${id} not found`);
  }

  const messages = await repositories.conversations.listMessages(id);
  const documents = await repositories.documents.listByConversation(id);

  return { conversation, messages, documents };
}
