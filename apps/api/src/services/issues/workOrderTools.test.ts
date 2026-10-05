import { describe, it, expect } from 'vitest';
import type { Issue } from '@truelinks/shared';
import { buildDraft, type DraftWorkOrderArgs, type WorkOrderTurnState } from './workOrderTools.ts';

const NOW = '2026-10-07T10:00:00.000Z';

const issue: Issue = {
  id: 'iss-1',
  unitId: 'MC-B-0902',
  conversationId: 'conv-1',
  reporterRole: 'tenant',
  photos: [],
  createdAt: NOW,
};

const clause = {
  id: 'c7',
  heading: '7. Maintenance',
  text: 'The Tenant is responsible for minor repairs costing less than QAR 500 per item. The Landlord maintains plumbing.',
  pages: null,
};

const args: DraftWorkOrderArgs = {
  title: 'Kitchen tap drip and drain leak',
  description: 'Tap drips; drain fitting corroded and leaking.',
  category: 'plumbing',
  severity: 'medium',
  urgent: false,
  responsibility: 'split',
  responsibilityReason: 'Tap is a minor repair; the drain may exceed QAR 500.',
  clauseId: 'c7',
  quote: 'minor repairs costing less than QAR 500',
};

function state(overrides: Partial<WorkOrderTurnState> = {}): WorkOrderTurnState {
  return { issue, draft: null, leaseChecked: true, leaseId: 'lease-2', clauses: [clause], ...overrides };
}

describe('buildDraft', () => {
  it('builds a draft with the quoted clause and the lease id', () => {
    const draft = buildDraft(args, state(), NOW);
    expect(draft).toMatchObject({
      status: 'draft',
      unitId: 'MC-B-0902',
      leaseId: 'lease-2',
      responsibility: 'split',
      responsibilityClause: { clauseId: 'c7', heading: '7. Maintenance' },
    });
  });

  it('keeps the id and createdAt of an earlier draft so a redraft replaces it', () => {
    const first = buildDraft(args, state(), NOW);
    const second = buildDraft({ ...args, severity: 'high' }, state({ draft: first }), '2026-10-07T11:00:00.000Z');
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(NOW);
    expect(second.severity).toBe('high');
  });

  it('rejects a quote that is not in the clause', () => {
    expect(() => buildDraft({ ...args, quote: 'Landlord pays for everything' }, state(), NOW)).toThrow(/not in clause/);
  });

  it('rejects a clause id that is not in the lease', () => {
    expect(() => buildDraft({ ...args, clauseId: 'c99' }, state(), NOW)).toThrow(/not in the unit's lease/);
  });

  it('requires the lease to be read first', () => {
    expect(() => buildDraft(args, state({ leaseChecked: false }), NOW)).toThrow(/get_unit_lease/);
  });

  it("only allows 'unknown' when the unit has no confirmed lease", () => {
    const noLease = state({ leaseId: null, clauses: [] });
    expect(() => buildDraft({ ...args, clauseId: undefined, quote: undefined }, noLease, NOW)).toThrow(/unknown/);
    const draft = buildDraft(
      { ...args, responsibility: 'unknown', clauseId: undefined, quote: undefined },
      noLease,
      NOW
    );
    expect(draft.responsibilityClause).toBeNull();
    expect(draft.leaseId).toBeNull();
  });
});
