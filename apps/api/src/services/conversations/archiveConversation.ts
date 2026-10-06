import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Conversation } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { HttpError } from '../../utils/httpError.ts';
import { archiveBlockedReason, todayIso } from '../leases/unitLeases.ts';

async function getConversationOrThrow(conversationId: string, repositories: Repositories): Promise<Conversation> {
  const conversation = await repositories.conversations.get(conversationId);
  if (!conversation) {
    throw new HttpError(404, `Conversation ${conversationId} not found`);
  }
  return conversation;
}

// Why a conversation can't be archived, or null. An issue report always can; a lease follows archiveBlockedReason.
export async function getArchiveBlockedReason(conversation: Conversation, repositories: Repositories): Promise<string | null> {
  if (conversation.kind !== 'lease') return null;
  const lease = await repositories.leases.getByConversation(conversation.id);
  if (!lease) return null;
  const confirmed = lease.unitId
    ? (await repositories.leases.listByUnit(lease.unitId)).filter((l) => l.status === 'confirmed')
    : [];
  return archiveBlockedReason(lease, confirmed, todayIso());
}

export async function archiveConversation(conversationId: string, repositories: Repositories): Promise<Conversation> {
  const conversation = await getConversationOrThrow(conversationId, repositories);
  if (conversation.archivedAt) {
    return conversation;
  }

  const blocked = await getArchiveBlockedReason(conversation, repositories);
  if (blocked) {
    throw new HttpError(409, blocked);
  }

  return repositories.conversations.setArchivedAt(conversationId, new Date().toISOString());
}

export async function unarchiveConversation(conversationId: string, repositories: Repositories): Promise<Conversation> {
  await getConversationOrThrow(conversationId, repositories);
  return repositories.conversations.setArchivedAt(conversationId, null);
}

// Deleting is permanent, so only an archived conversation can be deleted. A work order judged
// against a lease keeps that lease: the repair decision must stay explainable.
export async function deleteConversation(
  conversationId: string,
  repositories: Repositories,
  uploadDir: string
): Promise<void> {
  const conversation = await getConversationOrThrow(conversationId, repositories);
  if (!conversation.archivedAt) {
    throw new HttpError(409, 'Archive it before deleting it');
  }

  const paths = await repositories.transaction(async (repos) => {
    if (conversation.kind === 'issue') {
      const issue = await repos.issues.getByConversation(conversationId);
      if (issue) {
        await repos.issues.deleteIssue(issue.id);
      }
      await repos.conversations.delete(conversationId);
      return issue ? [resolve(uploadDir, 'issues', issue.id)] : [];
    }

    const lease = await repos.leases.getByConversation(conversationId);
    if (lease) {
      const workOrders = await repos.issues.listWorkOrdersByLease(lease.id);
      if (workOrders.length > 0) {
        throw new HttpError(
          409,
          `${workOrders.length} work ${workOrders.length === 1 ? 'order refers' : 'orders refer'} to this lease, so it can't be deleted`
        );
      }
      await repos.leases.delete(lease.id);
    }
    const filePaths = await repos.documents.deleteByConversation(conversationId);
    await repos.conversations.delete(conversationId);
    return filePaths.map((filePath) => resolve(uploadDir, filePath));
  });

  // Files go only after the rows are gone, so a failed delete never leaves a record without its file
  for (const path of paths) {
    rmSync(path, { recursive: true, force: true });
  }
}
