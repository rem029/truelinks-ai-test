import type {
  Conversation,
  Message,
  Lease,
  LeaseDocument,
  ConversationDetails,
  ConversationReview,
} from '@truelinks/shared';
import type { Repositories } from '../db/repositories/index.ts';
import { HttpError } from '../../utils/httpError.ts';
import { listPendingItems, highSeverityFailures } from '../leases/review/pendingItems.ts';

export type { ConversationDetails, ConversationReview };

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
  const lease = await repositories.leases.getByConversation(id);

  const review: ConversationReview | null = lease
    ? {
        pending: listPendingItems(lease),
        highSeverityFailures: highSeverityFailures(lease),
      }
    : null;

  return { conversation, messages, documents, lease, review };
}

