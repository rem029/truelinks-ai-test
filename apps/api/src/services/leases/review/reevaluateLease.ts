import type { Lease } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { evaluateLease } from '../evaluateLease.ts';
import type { UnitMatch } from '../unitMatch.ts';
import { mergeFlags } from './mergeFlags.ts';

// Deterministically re-runs rules and flags against the current lease record without persisting
export async function reevaluateLease(
  lease: Lease,
  repositories: Repositories
): Promise<{ lease: Lease; unitMatch: UnitMatch }> {
  const conversation = await repositories.conversations.get(lease.conversationId);
  const docs = await repositories.documents.listByConversation(lease.conversationId);
  const latestDoc = docs.length > 0 ? docs[docs.length - 1] : undefined;

  const evaluation = await evaluateLease(
    {
      record: lease.record,
      pageUnitId: conversation?.unitId,
      document: latestDoc,
    },
    repositories
  );

  const flags = mergeFlags(lease.flags, evaluation.flags, lease.record);
  const unitId = evaluation.unitMatch.status === 'matched' ? evaluation.unitMatch.unit.unitId : null;

  const reevaluated: Lease = {
    ...lease,
    unitId,
    flags,
    ruleResults: evaluation.ruleResults,
    rulesetVersion: evaluation.rulesetVersion,
    updatedAt: new Date().toISOString(),
  };

  return { lease: reevaluated, unitMatch: evaluation.unitMatch };
}
