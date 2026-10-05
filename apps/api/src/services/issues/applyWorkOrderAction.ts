import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  type Action,
  type Message,
  type WorkOrder,
  type WorkOrderTurnResponse,
  Responsibility,
  Severity,
} from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { HttpError } from '../../utils/httpError.ts';
import { loadIssueForWorkOrder, workOrderCard } from './workOrderTurn.ts';

export const WorkOrderEdit = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(1000),
    category: z.string().trim().min(1),
    severity: Severity,
    urgent: z.boolean(),
    responsibility: Responsibility,
    responsibilityReason: z.string().trim().min(1),
  })
  .partial()
  .strict();
export type WorkOrderEdit = z.infer<typeof WorkOrderEdit>;

export function applyWorkOrderEdit(workOrder: WorkOrder, edit: WorkOrderEdit, now: string): WorkOrder {
  const responsibilityChanged =
    edit.responsibility !== undefined && edit.responsibility !== workOrder.responsibility;
  return {
    ...workOrder,
    ...edit,
    // The quoted clause backed the agent's party; once the owner picks another, it no longer applies
    responsibilityClause: responsibilityChanged ? null : workOrder.responsibilityClause,
    responsibilityReason:
      edit.responsibilityReason ??
      (responsibilityChanged ? 'Set by the owner' : workOrder.responsibilityReason),
    status: 'draft',
    updatedAt: now,
  };
}

// "Changed severity to high, marked urgent": long text fields are named, not repeated
export function describeEdit(edit: WorkOrderEdit): string {
  const parts = Object.entries(edit).map(([key, value]) => {
    if (key === 'urgent') return value ? 'marked urgent' : 'marked not urgent';
    if (key === 'description') return 'changed the description';
    if (key === 'responsibilityReason') return 'changed the responsibility reason';
    return `changed ${key} to ${String(value)}`;
  });
  const text = parts.join(', ') || 'changed nothing';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function message(conversationId: string, role: 'user' | 'assistant', text: string, workOrder?: WorkOrder): Message {
  return {
    id: randomUUID(),
    conversationId,
    role,
    text,
    cards: workOrder ? [workOrderCard(workOrder)] : [],
    attachments: [],
    agentRun: null,
    // Order the reply after the user message created in the same action
    createdAt: new Date(Date.now() + (role === 'assistant' ? 1 : 0)).toISOString(),
  };
}

export async function applyWorkOrderAction(
  conversationId: string,
  action: Action,
  ctx: { repositories: Repositories }
): Promise<WorkOrderTurnResponse> {
  const { repositories } = ctx;
  if (action.type !== 'accept' && action.type !== 'reject' && action.type !== 'edit') {
    throw new HttpError(400, `Action ${action.type} is not allowed on an issue report`);
  }
  if (action.cardId !== 'workOrder') {
    throw new HttpError(404, `Card ${action.cardId} not found`);
  }

  const { workOrder } = await loadIssueForWorkOrder(conversationId, repositories);
  if (!workOrder) {
    throw new HttpError(400, 'There is no work order draft yet');
  }

  const now = new Date().toISOString();
  let updated: WorkOrder;
  let userText: string;
  let replyText: string;

  if (action.type === 'accept') {
    updated = { ...workOrder, status: 'accepted', updatedAt: now };
    userText = 'Accepted the work order';
    replyText = `Work order saved for unit ${workOrder.unitId}.`;
  } else if (action.type === 'reject') {
    updated = { ...workOrder, status: 'rejected', updatedAt: now };
    userText = action.reason ? `Rejected the work order: ${action.reason}` : 'Rejected the work order';
    replyText = "Rejected. Tell me what's wrong and I'll redraft it.";
  } else {
    const parsed = WorkOrderEdit.safeParse(action.value);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid work order edit', { issues: parsed.error.issues });
    }
    updated = applyWorkOrderEdit(workOrder, parsed.data, now);
    userText = describeEdit(parsed.data);
    replyText = 'Updated the draft. Accept it when it looks right.';
  }

  const userMessage = message(conversationId, 'user', userText);
  const replyMessage = message(
    conversationId,
    'assistant',
    replyText,
    action.type === 'reject' ? undefined : updated
  );

  await repositories.transaction(async (trx) => {
    await trx.issues.updateWorkOrder(updated);
    await trx.conversations.addMessage(userMessage);
    await trx.conversations.addMessage(replyMessage);
    if (action.type === 'accept') {
      await trx.conversations.setStatus(conversationId, 'confirmed');
    }
  });

  console.log(`work-order action=${action.type} conversation=${conversationId} workOrder=${updated.id}`);
  return { workOrder: updated, messages: [userMessage, replyMessage] };
}
