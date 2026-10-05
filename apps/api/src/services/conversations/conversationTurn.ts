import type { Action, ConversationActionResponse, WorkOrderTurnResponse } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import type { ModelProvider } from '../agents/modelProvider/types.ts';
import { HttpError } from '../../utils/httpError.ts';
import { applyCardAction } from '../leases/review/applyCardAction.ts';
import { runCorrectionTurn } from '../leases/review/correctionTurn.ts';
import { applyWorkOrderAction } from '../issues/applyWorkOrderAction.ts';
import { runWorkOrderTurn } from '../issues/workOrderTurn.ts';

interface TurnContext {
  repositories: Repositories;
  modelProvider: ModelProvider;
}

async function kindOf(conversationId: string, repositories: Repositories) {
  const conversation = await repositories.conversations.get(conversationId);
  if (!conversation) {
    throw new HttpError(404, `Conversation ${conversationId} not found`);
  }
  return conversation.kind;
}

// Lease reviews and issue reports share the thread endpoints; each kind has its own agent
export async function applyAction(
  conversationId: string,
  action: Action,
  ctx: TurnContext
): Promise<ConversationActionResponse | WorkOrderTurnResponse> {
  const kind = await kindOf(conversationId, ctx.repositories);
  return kind === 'issue'
    ? applyWorkOrderAction(conversationId, action, ctx)
    : applyCardAction(conversationId, action, ctx);
}

export async function postMessage(
  conversationId: string,
  text: string,
  ctx: TurnContext
): Promise<ConversationActionResponse | WorkOrderTurnResponse> {
  const kind = await kindOf(conversationId, ctx.repositories);
  return kind === 'issue'
    ? runWorkOrderTurn(conversationId, text, ctx)
    : runCorrectionTurn(conversationId, text, ctx);
}
