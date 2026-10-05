import type { ConversationKind, ConversationSummary } from '@truelinks/shared';
import type { Repositories } from '../db/repositories/index.ts';
import { listPendingItems } from '../leases/review/pendingItems.ts';

export interface ListConversationsFilter {
  kind?: ConversationKind;
}

export async function listConversations(
  filter: ListConversationsFilter,
  repositories: Repositories
): Promise<ConversationSummary[]> {
  const conversations = await repositories.conversations.list(filter);

  // Note: N+1 query pattern per conversation (fetching docs & lease).
  // Fine for current scale; at scale join via a single optimized query or projection.
  const summaries: ConversationSummary[] = [];

  for (const conv of conversations) {
    const docs = await repositories.documents.listByConversation(conv.id);
    if (docs.length === 0) {
      continue;
    }
    const lease = await repositories.leases.getByConversation(conv.id);

    summaries.push({
      id: conv.id,
      kind: conv.kind,
      status: conv.status,
      unitId: lease?.unitId ?? conv.unitId,
      filename: docs[0]?.filename ?? null,
      leaseStatus: lease?.status ?? null,
      analysisStatus: lease?.analysisStatus ?? null,
      openItems: lease ? listPendingItems(lease).length : null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    });
  }

  return summaries;
}
