import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AgentRun, Issue, Message, WorkOrder, WorkOrderCard } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import type { ChatMessage, ModelProvider } from '../agents/modelProvider/types.ts';
import { runAgentTurn, type AgentTurnResult, type ToolCallLog } from '../agents/agentLoop.ts';
import { HttpError } from '../../utils/httpError.ts';
import { dedupeDamages } from './summaryText.ts';
import { createWorkOrderTools, type WorkOrderTurnState } from './workOrderTools.ts';

const PROMPT_PATH = resolve(import.meta.dirname, '../agents/prompts/workOrderDraft.md');
const WORK_ORDER_PROMPT = readFileSync(PROMPT_PATH, 'utf-8');

export interface WorkOrderTurnContext {
  repositories: Repositories;
  modelProvider: ModelProvider;
}

export interface WorkOrderTurnResult {
  workOrder: WorkOrder | null;
  messages: Message[];
}

// Code decides whether there is anything to repair; the agent only runs when the photos show damage
export function needsWorkOrder(issue: Issue): boolean {
  return dedupeDamages(issue.photos).length > 0;
}

export function workOrderCard(workOrder: WorkOrder): WorkOrderCard {
  return { id: 'workOrder', type: 'workOrder', workOrder };
}

function describeIssue(issue: Issue, draft: WorkOrder | null): string {
  const photoLines = issue.photos.map(
    (p) =>
      `- ${p.filename}: ${p.condition}; damages: ${p.damages.join(', ') || 'none'}; equipment: ${p.equipment.join(', ') || 'none'}${p.note ? `; note: ${p.note}` : ''}`
  );
  const lines = [
    `Unit: ${issue.unitId}`,
    `Reported by: ${issue.reporterRole}`,
    `Reporter's note: ${issue.note ?? 'none'}`,
    'Photo findings:',
    ...photoLines,
  ];
  if (draft) {
    lines.push('Current draft work order:', JSON.stringify(draft));
  }
  return lines.join('\n');
}

export async function loadIssueForWorkOrder(conversationId: string, repositories: Repositories) {
  const conversation = await repositories.conversations.get(conversationId);
  if (!conversation) {
    throw new HttpError(404, `Conversation ${conversationId} not found`);
  }
  if (conversation.kind !== 'issue') {
    throw new HttpError(400, 'Conversation is not an issue report');
  }
  const issue = await repositories.issues.getByConversation(conversationId);
  if (!issue) {
    throw new HttpError(400, 'Report the issue with photos first');
  }
  const workOrder = await repositories.issues.getWorkOrderByIssue(issue.id);
  if (workOrder?.status === 'accepted') {
    throw new HttpError(409, 'The work order is already accepted');
  }
  return { issue, workOrder };
}

// The lease text is model context; the thread only needs to show that the lease was read
function withoutLeaseText(call: ToolCallLog): ToolCallLog {
  if (!call.ok || call.name !== 'get_unit_lease') return call;
  const result = call.result as { leaseId?: string; tenant?: string; clauses?: unknown[]; reason?: string };
  return result.clauses
    ? { ...call, result: { leaseId: result.leaseId, tenant: result.tenant, clauseCount: result.clauses.length } }
    : call;
}

export async function runWorkOrderTurn(
  conversationId: string,
  userText: string | null,
  ctx: WorkOrderTurnContext
): Promise<WorkOrderTurnResult> {
  const start = Date.now();
  const { repositories, modelProvider } = ctx;
  const { issue, workOrder: existing } = await loadIssueForWorkOrder(conversationId, repositories);

  const savedMessages: Message[] = [];
  if (userText) {
    const userMessage: Message = {
      id: randomUUID(),
      conversationId,
      role: 'user',
      text: userText,
      cards: [],
      attachments: [],
      agentRun: null,
      createdAt: new Date().toISOString(),
    };
    await repositories.conversations.addMessage(userMessage);
    savedMessages.push(userMessage);
  }

  const history = await repositories.conversations.listMessages(conversationId);
  const historyMessages: ChatMessage[] = history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text.trim().length > 0)
    .slice(-10)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text }));

  const state: WorkOrderTurnState = {
    issue,
    draft: existing,
    leaseChecked: false,
    leaseId: null,
    clauses: [],
  };

  let turnResult: AgentTurnResult;
  try {
    turnResult = await runAgentTurn({
      purpose: 'work-order',
      provider: modelProvider,
      messages: [
        { role: 'system', content: `${WORK_ORDER_PROMPT}\n\n${describeIssue(issue, existing)}` },
        ...historyMessages,
      ],
      tools: createWorkOrderTools(state, { repositories }),
      maxSteps: 6,
      reasoningEffort: 'low',
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`work-order conversation=${conversationId} failed: ${reason}`);
    throw new HttpError(502, 'Work order draft failed; send a message to retry', { reason });
  }

  const draft = state.draft;
  const drafted = draft !== null && draft !== existing;
  const showCard = draft !== null && !turnResult.askedUser;

  const agentRun: AgentRun = {
    model: turnResult.model,
    inputTokens: turnResult.usage.inputTokens,
    outputTokens: turnResult.usage.outputTokens,
    ms: Date.now() - start,
    toolCalls: turnResult.toolCalls.map(withoutLeaseText),
  };

  const assistantMessage: Message = {
    id: randomUUID(),
    conversationId,
    role: 'assistant',
    text: turnResult.reply,
    cards: showCard ? [workOrderCard(draft)] : [],
    attachments: [],
    agentRun,
    // Order the reply after the user message saved in the same turn
    createdAt: new Date(Date.now() + 1).toISOString(),
  };

  await repositories.transaction(async (trx) => {
    if (drafted) {
      if (existing) {
        await trx.issues.updateWorkOrder(draft);
      } else {
        await trx.issues.createWorkOrder(draft);
      }
    }
    await trx.conversations.addMessage(assistantMessage);
  });
  savedMessages.push(assistantMessage);

  const steps = turnResult.messages.filter((m) => m.role === 'assistant').length;
  console.log(
    `work-order conversation=${conversationId} steps/tools=${steps}/${turnResult.toolCalls.length} asked=${turnResult.askedUser} drafted=${drafted} ms=${Date.now() - start}`
  );

  return { workOrder: draft, messages: savedMessages };
}
