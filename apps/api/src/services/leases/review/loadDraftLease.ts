import type { Conversation, Lease } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { HttpError } from '../../../utils/httpError.ts';

// Validates that the conversation and lease exist and are not yet confirmed
export async function loadDraftLease(
  conversationId: string,
  repositories: Repositories
): Promise<{ conversation: Conversation; lease: Lease }> {
  const conversation = await repositories.conversations.get(conversationId);
  if (!conversation) {
    throw new HttpError(404, 'Conversation not found');
  }

  const lease = await repositories.leases.getByConversation(conversationId);
  if (!lease) {
    throw new HttpError(404, 'Lease not found');
  }

  if (lease.status === 'confirmed') {
    throw new HttpError(409, 'Lease is already confirmed');
  }

  return { conversation, lease };
}
