import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AgentRun, Lease, Message } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import type { ModelProvider, ChatMessage } from '../../agents/modelProvider/types.ts';
import { HttpError } from '../../../utils/httpError.ts';
import { listFields } from '../leaseFields.ts';
import { listPendingItems } from './pendingItems.ts';
import { describeChanges } from './reviewCards.ts';
import { reevaluateLease } from './reevaluateLease.ts';
import { addReviewMessage } from './reviewMessage.ts';
import { createLeaseTools, type LeaseTurnState } from './leaseTools.ts';
import { runAgentTurn, type AgentTurnResult } from '../../agents/agentLoop.ts';
import { loadDraftLease } from './loadDraftLease.ts';

const PROMPT_PATH = resolve(import.meta.dirname, '../../agents/prompts/leaseCorrection.md');
const LEASE_CORRECTION_PROMPT = readFileSync(PROMPT_PATH, 'utf-8');

export interface CorrectionTurnContext {
  repositories: Repositories;
  modelProvider: ModelProvider;
}

export async function runCorrectionTurn(
  conversationId: string,
  text: string,
  ctx: CorrectionTurnContext
): Promise<{ lease: Lease; messages: Message[] }> {
  const start = Date.now();
  const { repositories, modelProvider } = ctx;

  const { lease } = await loadDraftLease(conversationId, repositories);

  const docs = await repositories.documents.listByConversation(conversationId);
  const document = docs.length > 0 ? docs[docs.length - 1] : undefined;

  const messageId = randomUUID();
  const now = new Date().toISOString();

  const userMessage: Message = {
    id: messageId,
    conversationId,
    role: 'user',
    text,
    cards: [],
    attachments: [],
    agentRun: null,
    createdAt: now,
  };
  await repositories.conversations.addMessage(userMessage);

  const currentFieldsLines = listFields(lease.record).map(({ fieldPath, field }) => {
    const valStr = field.value !== null ? String(field.value) : 'not found';
    return `${fieldPath} = ${valStr} [${field.review.status}]`;
  });

  const pending = listPendingItems(lease);
  const pendingStr = pending.length > 0 ? pending.join('\n') : 'None';

  const systemContent = [
    LEASE_CORRECTION_PROMPT,
    'Current fields:\n' + currentFieldsLines.join('\n'),
    'Open items:\n' + pendingStr,
  ].join('\n\n');

  const allMessages = await repositories.conversations.listMessages(conversationId);
  const historyMessages: ChatMessage[] = allMessages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text.trim().length > 0)
    .slice(-10)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.text,
    }));

  const state: LeaseTurnState = {
    lease: { ...lease },
    document,
    messageId,
  };

  const tools = createLeaseTools(state, { repositories });

  const turnStart = Date.now();
  let turnResult: AgentTurnResult;
  try {
    turnResult = await runAgentTurn({
      purpose: 'lease-correction',
      provider: modelProvider,
      messages: [{ role: 'system', content: systemContent }, ...historyMessages],
      tools,
      maxSteps: 6,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`lease correction conversation=${conversationId} failed: ${reason}`);
    throw new HttpError(502, 'Correction failed; try again or use the cards', { reason });
  }
  const turnDuration = Date.now() - turnStart;

  const { lease: reevaluated, unitMatch } = await reevaluateLease(state.lease, repositories);
  const recordChanged = JSON.stringify(state.lease.record) !== JSON.stringify(lease.record);
  const savedLease = recordChanged ? await repositories.leases.update(reevaluated) : lease;

  const diffLines = describeChanges(lease, savedLease);
  let assistantText = turnResult.reply;

  if (!turnResult.askedUser) {
    const remainingPending = listPendingItems(savedLease);
    const statusText =
      remainingPending.length === 0 ? 'Ready to confirm.' : `Still open: ${remainingPending.length}.`;
    const parts = [turnResult.reply];
    if (diffLines.length > 0) {
      parts.push(diffLines.join('\n'));
    }
    parts.push(statusText);
    assistantText = parts.filter(Boolean).join('\n');
  }

  const agentRun: AgentRun = {
    model: turnResult.model,
    inputTokens: turnResult.usage.inputTokens,
    outputTokens: turnResult.usage.outputTokens,
    ms: turnDuration,
    toolCalls: turnResult.toolCalls,
  };

  const assistantMessage = await addReviewMessage(
    savedLease,
    unitMatch,
    assistantText,
    repositories,
    agentRun
  );

  const assistantSteps = turnResult.messages.filter((m) => m.role === 'assistant').length;
  console.log(
    `lease correction conversation=${conversationId} steps/tools=${assistantSteps}/${turnResult.toolCalls.length} asked=${turnResult.askedUser} changes=${diffLines.length} ms=${Date.now() - start}`
  );

  return { lease: savedLease, messages: [userMessage, assistantMessage] };
}
