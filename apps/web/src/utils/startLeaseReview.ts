import { createConversation } from './api.ts';
import { navigate } from './router.ts';

// The unit isn't known until the lease is read, so a lease review starts without one
export async function startLeaseReview(): Promise<void> {
  const conversation = await createConversation('lease');
  navigate({ name: 'thread', conversationId: conversation.id });
}
