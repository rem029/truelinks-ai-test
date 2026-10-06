import type { ConversationKind, ConversationSummary, Lease } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { listPendingItems } from '../leases/review/pendingItems.ts';
import { archiveBlockedReason, todayIso } from '../leases/unitLeases.ts';

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
  const today = todayIso();
  const confirmedByUnit = new Map<string, Lease[]>();
  async function confirmedLeasesOf(unitId: string): Promise<Lease[]> {
    let leases = confirmedByUnit.get(unitId);
    if (!leases) {
      leases = (await repositories.leases.listByUnit(unitId)).filter((l) => l.status === 'confirmed');
      confirmedByUnit.set(unitId, leases);
    }
    return leases;
  }

  for (const conv of conversations) {
    if (conv.kind === 'issue') {
      const issue = await repositories.issues.getByConversation(conv.id);
      if (!issue) {
        continue;
      }
      const workOrder = await repositories.issues.getWorkOrderByIssue(issue.id);

      summaries.push({
        id: conv.id,
        kind: conv.kind,
        status: conv.status,
        unitId: issue.unitId ?? conv.unitId,
        filename: null,
        leaseStatus: null,
        analysisStatus: null,
        openItems: null,
        photoCount: issue.photos.length,
        workOrder: workOrder
          ? { title: workOrder.title, status: workOrder.status, severity: workOrder.severity, urgent: workOrder.urgent }
          : null,
        archivedAt: conv.archivedAt,
        archiveBlockedReason: null,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      });
      continue;
    }

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
      photoCount: null,
      workOrder: null,
      archivedAt: conv.archivedAt,
      archiveBlockedReason: lease
        ? archiveBlockedReason(lease, lease.unitId ? await confirmedLeasesOf(lease.unitId) : [], today)
        : null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    });
  }

  return summaries;
}
