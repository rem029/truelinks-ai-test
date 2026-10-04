import { randomUUID } from 'node:crypto';
import type { Conversation, ConversationKind } from '@truelinks/shared';
import type { Repositories } from '../db/repositories/index.ts';
import { HttpError } from '../../utils/httpError.ts';

export interface CreateConversationInput {
  kind: ConversationKind;
  unitId?: string | null;
}

export async function createConversation(
  input: CreateConversationInput,
  repositories: Repositories
): Promise<Conversation> {
  const { kind, unitId } = input;

  if (unitId) {
    const unit = await repositories.units.get(unitId);
    if (!unit) {
      throw new HttpError(400, `Unit ${unitId} not found`);
    }
  }

  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: randomUUID(),
    kind,
    unitId: unitId ?? null,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };

  return repositories.conversations.create(conversation);
}
