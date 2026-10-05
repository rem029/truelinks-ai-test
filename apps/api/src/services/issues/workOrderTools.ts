import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { type Clause, type Issue, type WorkOrder, Responsibility, Severity } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { defineTool, type Tool } from '../agents/toolRegistry.ts';
import { askUserTool } from '../agents/askUserTool.ts';
import { verifyQuote } from '../leases/extract/verifyQuote.ts';

export interface WorkOrderTurnState {
  issue: Issue;
  draft: WorkOrder | null;
  // Set by get_unit_lease; a draft that names a party must come after the lease was read
  leaseChecked: boolean;
  leaseId: string | null;
  clauses: Clause[];
}

export const DraftWorkOrderArgs = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  category: z.string().min(1),
  severity: Severity,
  urgent: z.boolean(),
  responsibility: Responsibility,
  responsibilityReason: z.string().min(1),
  clauseId: z.string().optional(),
  quote: z.string().optional(),
});
export type DraftWorkOrderArgs = z.infer<typeof DraftWorkOrderArgs>;

// The unit's lease only counts once the owner has confirmed it; a draft lease is not yet the agreement
async function findConfirmedLease(unitId: string, repositories: Repositories) {
  const leases = await repositories.leases.listByUnit(unitId);
  const confirmed = leases
    .filter((lease) => lease.status === 'confirmed')
    .sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''));
  return confirmed[0] ?? null;
}

export function buildDraft(args: DraftWorkOrderArgs, state: WorkOrderTurnState, now: string): WorkOrder {
  let responsibilityClause: WorkOrder['responsibilityClause'] = null;

  if (!state.leaseChecked) {
    throw new Error('Call get_unit_lease before drafting');
  }
  if (state.leaseId === null && args.responsibility !== 'unknown') {
    throw new Error("No confirmed lease on file, so responsibility must be 'unknown'");
  }

  if (args.clauseId) {
    const clause = state.clauses.find((c) => c.id === args.clauseId);
    if (!clause) {
      throw new Error(`Clause '${args.clauseId}' is not in the unit's lease; call get_unit_lease and use one of its clause ids`);
    }
    if (!args.quote || !verifyQuote(state.clauses, args.clauseId, args.quote)) {
      throw new Error(`The quote is not in clause '${args.clauseId}'; copy the words exactly from the clause text`);
    }
    responsibilityClause = { clauseId: clause.id, heading: clause.heading, quote: args.quote };
  }

  return {
    id: state.draft?.id ?? randomUUID(),
    issueId: state.issue.id,
    unitId: state.issue.unitId,
    title: args.title,
    description: args.description,
    category: args.category,
    severity: args.severity,
    urgent: args.urgent,
    responsibility: args.responsibility,
    responsibilityReason: args.responsibilityReason,
    responsibilityClause,
    leaseId: state.leaseId,
    status: 'draft',
    createdAt: state.draft?.createdAt ?? now,
    updatedAt: now,
  };
}

export function createWorkOrderTools(state: WorkOrderTurnState, ctx: { repositories: Repositories }): Tool[] {
  const getUnitLeaseTool = defineTool({
    name: 'get_unit_lease',
    description: "Get the unit's confirmed lease: tenant and every clause (id, heading, text). Use it to find who is responsible for the repair.",
    args: z.object({}),
    handler: async () => {
      const lease = await findConfirmedLease(state.issue.unitId, ctx.repositories);
      state.leaseChecked = true;
      if (!lease) {
        return { lease: null, reason: 'No confirmed lease on file for this unit' };
      }
      const documents = await ctx.repositories.documents.listByConversation(lease.conversationId);
      const clauses = documents[documents.length - 1]?.clauses ?? [];
      state.leaseId = lease.id;
      state.clauses = clauses;
      return {
        leaseId: lease.id,
        tenant: lease.record.tenant.name.value,
        clauses: clauses.map((c) => ({ id: c.id, heading: c.heading, text: c.text })),
      };
    },
  });

  const draftWorkOrderTool = defineTool({
    name: 'draft_work_order',
    description:
      'Save the draft work order (replaces an earlier draft). The owner reviews it; this does not approve it. Give clauseId + an exact quote when the lease says who is responsible.',
    args: DraftWorkOrderArgs,
    handler: (args) => {
      state.draft = buildDraft(args, state, new Date().toISOString());
      return 'Draft saved';
    },
  });

  return [getUnitLeaseTool, draftWorkOrderTool, askUserTool];
}
