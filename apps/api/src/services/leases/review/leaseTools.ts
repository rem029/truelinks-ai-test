import { z } from 'zod';
import type { Lease, LeaseDocument } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { defineTool, type Tool } from '../../agents/toolRegistry.ts';
import { askUserTool } from '../../agents/askUserTool.ts';
import { FIELD_PATHS, getField } from '../leaseFields.ts';
import { editField, isLocked, parseFieldValue } from './patchRecord.ts';
import { reevaluateLease } from './reevaluateLease.ts';

export interface LeaseTurnState {
  lease: Lease;
  document?: LeaseDocument;
  messageId: string;
}

export interface LeaseToolsContext {
  repositories: Repositories;
}

export function createLeaseTools(state: LeaseTurnState, ctx: LeaseToolsContext): Tool[] {
  const searchClausesTool = defineTool({
    name: 'search_clauses',
    description: 'Search clauses of the lease document by keywords for relevant headings or text',
    args: z.object({
      query: z.string().describe('Search query words (case-insensitive, matching words with >= 3 characters)'),
    }),
    handler: async (args) => {
      const words = args.query
        .toLowerCase()
        .split(/[^a-z0-9_-]+/)
        .filter((w) => w.length >= 3);

      if (words.length === 0 || !state.document) {
        return [];
      }

      return state.document.clauses
        .map((clause) => {
          const content = `${clause.heading} ${clause.text}`.toLowerCase();
          let matches = 0;
          for (const word of words) {
            if (content.includes(word)) {
              matches++;
            }
          }
          return { clause, matches };
        })
        .filter((item) => item.matches > 0)
        .sort((a, b) => b.matches - a.matches)
        .slice(0, 5)
        .map(({ clause }) => ({
          id: clause.id,
          heading: clause.heading,
          page: clause.pages?.start ?? null,
          text: clause.text.slice(0, 400),
        }));
    },
  });

  const updateFieldTool = defineTool({
    name: 'update_field',
    description: 'Update a specific field in the lease record from user instructions',
    args: z.object({
      fieldPath: z.enum(FIELD_PATHS),
      value: z
        .string()
        .describe('New value as text, e.g. "8500", "2026-11-01", "true", "MC-B-1204"'),
    }),
    handler: async (args) => {
      const current = getField(state.lease.record, args.fieldPath);
      if (isLocked(current)) {
        throw new Error(
          `${args.fieldPath} was already accepted by the owner; ask them to use Edit on its card`
        );
      }

      const parsed = parseFieldValue(args.fieldPath, args.value);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      const previous = current.value;
      state.lease.record = editField(
        state.lease.record,
        args.fieldPath,
        args.value,
        state.messageId,
        new Date().toISOString()
      );

      return {
        fieldPath: args.fieldPath,
        value: parsed.value,
        previous,
      };
    },
  });

  const findUnitTool = defineTool({
    name: 'find_unit',
    description: 'Find matching units in the property registry by unit ID, label, parking bay, or building',
    args: z.object({
      query: z.string().describe('Search query matching unit attributes'),
    }),
    handler: async (args) => {
      const units = await ctx.repositories.units.list();
      const q = args.query.trim().toLowerCase();
      return units
        .filter(
          (u) =>
            u.unitId.toLowerCase().includes(q) ||
            u.label.toLowerCase().includes(q) ||
            u.parkingBay.toLowerCase().includes(q) ||
            u.buildingName.toLowerCase().includes(q)
        )
        .slice(0, 5)
        .map((u) => ({
          unitId: u.unitId,
          label: u.label,
          parkingBay: u.parkingBay,
          status: u.status,
        }));
    },
  });

  const evaluateRulesTool = defineTool({
    name: 'evaluate_rules',
    description: 'Re-evaluate acceptance rules and flags against the current lease record',
    args: z.object({}),
    handler: async () => {
      const { lease: reevaluated } = await reevaluateLease(state.lease, ctx.repositories);
      return {
        rules: reevaluated.ruleResults.map((r) => ({
          ruleId: r.ruleId,
          status: r.status,
          reason: r.reason,
        })),
        openFlags: reevaluated.flags.filter((f) => f.reviewStatus === 'open').length,
      };
    },
  });

  return [searchClausesTool, updateFieldTool, findUnitTool, evaluateRulesTool, askUserTool];
}
