import { randomUUID } from 'node:crypto';
import type { AgentRun, Lease, Message } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import type { UnitMatch } from '../unitMatch.ts';
import { buildReviewCards } from './reviewCards.ts';
import { reevaluateLease } from './reevaluateLease.ts';

// Attaches the generated review cards to an assistant message in the conversation
export async function addReviewMessage(
  lease: Lease,
  unitMatch: UnitMatch,
  text: string,
  repositories: Repositories,
  agentRun: AgentRun | null = null
): Promise<Message> {
  const cards = buildReviewCards(lease, unitMatch);
  const message: Message = {
    id: randomUUID(),
    conversationId: lease.conversationId,
    role: 'assistant',
    text,
    cards,
    attachments: [],
    agentRun,
    createdAt: new Date().toISOString(),
  };

  return repositories.conversations.addMessage(message);
}

// Generates the first assistant review message right after lease extraction
export async function addFirstReviewMessage(
  lease: Lease,
  filename: string,
  repositories: Repositories
): Promise<Message> {
  const { unitMatch } = await reevaluateLease(lease, repositories);
  const cards = buildReviewCards(lease, unitMatch);
  const attentionCount = cards.filter((c) => c.type !== 'summary').length;
  const reviewText =
    attentionCount === 0
      ? `I read ${filename}. Nothing needs your attention; the rest look fine.`
      : `I read ${filename}. ${attentionCount} item${attentionCount === 1 ? '' : 's'} need your attention; the rest look fine.`;

  return addReviewMessage(lease, unitMatch, reviewText, repositories);
}
