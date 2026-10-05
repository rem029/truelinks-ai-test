import { randomUUID } from 'node:crypto';
import type { Lease, Message } from '@truelinks/shared';
import type { Repositories } from '../../../db/repositories/index.ts';
import { HttpError } from '../../../utils/httpError.ts';
import { listPendingItems, highSeverityFailures } from './pendingItems.ts';
import { addReviewMessage } from './reviewMessage.ts';

// Confirms the lease, occupies the unit, and completes the conversation; called only on explicit user action
export async function confirmLease(
  lease: Lease,
  overrideReason: string | undefined,
  repositories: Repositories
): Promise<{ lease: Lease; messages: Message[] }> {
  const start = Date.now();
  const pending = listPendingItems(lease);
  if (pending.length > 0) {
    throw new HttpError(409, `Cannot confirm lease with pending items: ${pending.join('; ')}`, { pending });
  }

  const failures = highSeverityFailures(lease);
  const trimmedOverride = overrideReason?.trim() || null;
  if (failures.length > 0 && !trimmedOverride) {
    throw new HttpError(
      409,
      `Override reason required for high-severity rule failures: ${failures.map((f) => f.ruleId).join(', ')}`,
      { failures: failures.map((f) => f.ruleId) }
    );
  }

  const unitId = lease.unitId;
  if (!unitId) {
    throw new HttpError(409, 'Lease has no confirmed unit');
  }

  const unit = await repositories.units.get(unitId);
  if (!unit) {
    throw new HttpError(404, `Unit ${unitId} not found`);
  }

  const now = new Date().toISOString();
  const updatedUnit = { ...unit, status: 'occupied' as const };

  const { confirmedLease, messages } = await repositories.transaction(async (trxRepos) => {
    await trxRepos.units.setStatus(unitId, 'occupied');
    await trxRepos.conversations.setStatus(lease.conversationId, 'confirmed');

    const confirmed: Lease = {
      ...lease,
      status: 'confirmed',
      confirmedAt: now,
      overrideReason: trimmedOverride,
      updatedAt: now,
    };
    await trxRepos.leases.update(confirmed);

    const userText = trimmedOverride ? `Confirmed lease (override: ${trimmedOverride})` : 'Confirmed lease';
    const userMessage: Message = {
      id: randomUUID(),
      conversationId: lease.conversationId,
      role: 'user',
      text: userText,
      cards: [],
      attachments: [],
      agentRun: null,
      createdAt: now,
    };
    await trxRepos.conversations.addMessage(userMessage);

    const assistantText = `Lease confirmed. Unit ${unitId} marked occupied.`;
    const assistantMessage = await addReviewMessage(
      confirmed,
      { status: 'matched', unit: updatedUnit },
      assistantText,
      trxRepos
    );

    return { confirmedLease: confirmed, messages: [userMessage, assistantMessage] };
  });

  console.log(
    `lease confirm conversation=${lease.conversationId} lease=${lease.id} unit=${unitId} override=${!!trimmedOverride} ms=${Date.now() - start}`
  );

  return { lease: confirmedLease, messages };
}
