import { randomUUID } from 'node:crypto';
import {
  type Action,
  ALLOWED_ACTIONS,
  type Flag,
  type Lease,
  type LeaseRecord,
  type Message,
} from '@truelinks/shared';
import type { Repositories } from '../../../db/repositories/index.ts';
import { HttpError } from '../../../utils/httpError.ts';
import type { FieldPath } from '../leaseFields.ts';
import { acceptAllFields, acceptField, editField, rejectField } from './patchRecord.ts';
import { parseCardId } from './reviewCards.ts';
import { reevaluateLease } from './reevaluateLease.ts';
import { describeChanges } from './reviewCards.ts';
import { listPendingItems } from './pendingItems.ts';
import { addReviewMessage } from './reviewMessage.ts';
import { confirmLease } from './confirmLease.ts';
import { loadDraftLease } from './loadDraftLease.ts';

export interface CardActionContext {
  repositories: Repositories;
}

function applyFieldAction(
  action: Action,
  fieldPath: FieldPath,
  record: LeaseRecord,
  userMessageId: string,
  now: string
): { record: LeaseRecord; userText: string } {
  let userText = '';
  let updatedRecord = record;
  try {
    if (action.type === 'accept') {
      userText = `Accepted ${fieldPath}`;
      updatedRecord = acceptField(record, fieldPath, now);
    } else if (action.type === 'reject') {
      userText = `Rejected ${fieldPath}`;
      updatedRecord = rejectField(record, fieldPath, now);
    } else if (action.type === 'edit') {
      userText = `Changed ${fieldPath} to ${String(action.value)}`;
      updatedRecord = editField(record, fieldPath, action.value, userMessageId, now);
    }
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : String(err));
  }
  return { record: updatedRecord, userText };
}

function applyFlagAction(
  action: Action,
  flagId: string,
  flags: Flag[]
): { flags: Flag[]; userText: string } {
  const targetFlag = flags.find((f) => f.id === flagId);
  if (!targetFlag) {
    throw new HttpError(404, 'Flag not found');
  }
  const nextStatus: 'accepted' | 'dismissed' = action.type === 'accept' ? 'accepted' : 'dismissed';
  const userText =
    action.type === 'accept'
      ? `Acknowledged flag: ${targetFlag.message}`
      : `Dismissed flag: ${targetFlag.message}`;
  const updatedFlags = flags.map((f) => (f.id === flagId ? { ...f, reviewStatus: nextStatus } : f));
  return { flags: updatedFlags, userText };
}

async function chooseUnit(
  action: Action,
  record: LeaseRecord,
  repositories: Repositories,
  userMessageId: string,
  now: string
): Promise<{ record: LeaseRecord; userText: string }> {
  if (action.type !== 'choose') {
    throw new HttpError(400, `Action ${action.type} is not allowed for unitMatch card`);
  }
  const unit = await repositories.units.get(action.option);
  if (!unit) {
    throw new HttpError(404, `Unit ${action.option} not found`);
  }
  const userText = `Unit is ${action.option}`;
  const updatedRecord = editField(record, 'unit.unitId', action.option, userMessageId, now);
  return { record: updatedRecord, userText };
}

function applySummaryAction(
  action: Action,
  record: LeaseRecord,
  flags: Flag[],
  now: string
): { record: LeaseRecord; userText: string; acceptedCount: number } {
  if (action.type !== 'acceptAll') {
    throw new HttpError(400, `Action ${action.type} is not allowed for summary card`);
  }
  const userText = 'Accepted all remaining fields';
  const openFlags = flags.filter((f) => f.reviewStatus === 'open');
  const res = acceptAllFields(record, openFlags, now);
  return { record: res.record, userText, acceptedCount: res.acceptedPaths.length };
}

export async function applyCardAction(
  conversationId: string,
  action: Action,
  ctx: CardActionContext
): Promise<{ lease: Lease; messages: Message[] }> {
  const start = Date.now();
  const { repositories } = ctx;

  const { lease } = await loadDraftLease(conversationId, repositories);

  if (action.type === 'confirm') {
    return confirmLease(lease, action.overrideReason, repositories);
  }

  const parsedCard = action.type === 'acceptAll' ? { kind: 'summary' as const } : parseCardId(action.cardId);
  if (!parsedCard) {
    throw new HttpError(400, 'Invalid card ID');
  }

  const allowedActions = ALLOWED_ACTIONS[parsedCard.kind] as readonly string[];
  if (!allowedActions.includes(action.type)) {
    throw new HttpError(400, `Action ${action.type} is not allowed for ${parsedCard.kind} card`);
  }

  const userMessageId = randomUUID();
  const now = new Date().toISOString();

  let record = lease.record;
  let flags = lease.flags;
  let userText = '';
  let acceptedCount = 0;

  switch (parsedCard.kind) {
    case 'field': {
      const res = applyFieldAction(action, parsedCard.fieldPath, record, userMessageId, now);
      record = res.record;
      userText = res.userText;
      break;
    }
    case 'flag': {
      const res = applyFlagAction(action, parsedCard.flagId, flags);
      flags = res.flags;
      userText = res.userText;
      break;
    }
    case 'unitMatch': {
      const res = await chooseUnit(action, record, repositories, userMessageId, now);
      record = res.record;
      userText = res.userText;
      break;
    }
    case 'summary': {
      const res = applySummaryAction(action, record, flags, now);
      record = res.record;
      userText = res.userText;
      acceptedCount = res.acceptedCount;
      break;
    }
    default:
      throw new HttpError(400, `Unsupported card kind: ${(parsedCard as { kind: string }).kind}`);
  }

  const userMessage: Message = {
    id: userMessageId,
    conversationId,
    role: 'user',
    text: userText,
    cards: [],
    attachments: [],
    agentRun: null,
    createdAt: now,
  };
  await repositories.conversations.addMessage(userMessage);

  const intermediateLease: Lease = {
    ...lease,
    record,
    flags,
  };

  const { lease: after, unitMatch } = await reevaluateLease(intermediateLease, repositories);
  const savedLease = await repositories.leases.update(after);

  const diffLines = describeChanges(lease, savedLease);
  let changesText: string;
  if (action.type === 'acceptAll') {
    const summaryPrefix = acceptedCount > 0 ? `Accepted ${acceptedCount} fields.` : 'Nothing left to accept.';
    changesText = diffLines.length > 0 ? `${summaryPrefix}\n${diffLines.join('\n')}` : summaryPrefix;
  } else {
    changesText = diffLines.length > 0 ? diffLines.join('\n') : 'No changes.';
  }
  const pending = listPendingItems(savedLease);
  const statusText = pending.length === 0 ? 'Ready to confirm.' : `Still open: ${pending.length}.`;
  const assistantText = `${changesText}\n${statusText}`;

  const assistantMessage = await addReviewMessage(savedLease, unitMatch, assistantText, repositories);

  console.log(
    `lease card-action conversation=${conversationId} lease=${savedLease.id} action=${action.type} changes=${diffLines.length} ms=${Date.now() - start}`
  );

  return { lease: savedLease, messages: [userMessage, assistantMessage] };
}
