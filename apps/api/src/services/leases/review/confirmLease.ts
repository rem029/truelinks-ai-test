import { randomUUID } from 'node:crypto';
import type { Lease, Message } from '@truelinks/shared';
import type { Repositories } from '../../../db/repositories/index.ts';
import { HttpError } from '../../../utils/httpError.ts';
import { listPendingItems, highSeverityFailures } from './pendingItems.ts';
import { addReviewMessage } from './reviewMessage.ts';
import { describeLease, findOverlap, isInEffect, leaseTerm, todayIso } from '../unitLeases.ts';

// Confirms the lease and completes the conversation; occupies the unit only when the lease is in effect today.
// Called only on explicit user action.
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

  // Only one lease can be in effect on a unit, so an overlap is refused even with an override reason
  const confirmedLeases = (await repositories.leases.listByUnit(unitId)).filter(
    (other) => other.status === 'confirmed' && other.id !== lease.id
  );
  if (confirmedLeases.length > 0 && !leaseTerm(lease.record)) {
    throw new HttpError(409, `Unit ${unitId} has a confirmed lease; add commencement and expiry dates to check this one does not overlap it`);
  }
  const overlap = findOverlap(lease.record, confirmedLeases);
  if (overlap) {
    throw new HttpError(409, `Overlaps the confirmed lease on ${unitId} (${describeLease(overlap)}); only one lease can be in effect`, {
      leaseId: overlap.id,
    });
  }

  const now = new Date().toISOString();
  const inEffect = isInEffect(lease.record, todayIso());
  const updatedUnit = inEffect ? { ...unit, status: 'occupied' as const } : unit;

  const { confirmedLease, messages } = await repositories.transaction(async (trxRepos) => {
    if (inEffect) {
      await trxRepos.units.setStatus(unitId, 'occupied');
    }
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

    const assistantText = inEffect
      ? `Lease confirmed. Unit ${unitId} marked occupied.`
      : `Lease confirmed. It starts on ${lease.record.commencementDate.value}; unit ${unitId} stays ${unit.status} until then.`;
    const assistantMessage = await addReviewMessage(
      confirmed,
      { status: 'matched', unit: updatedUnit },
      assistantText,
      trxRepos
    );

    return { confirmedLease: confirmed, messages: [userMessage, assistantMessage] };
  });

  console.log(
    `lease confirm conversation=${lease.conversationId} lease=${lease.id} unit=${unitId} inEffect=${inEffect} override=${!!trimmedOverride} ms=${Date.now() - start}`
  );

  return { lease: confirmedLease, messages };
}
