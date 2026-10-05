import { describe, it, expect } from 'vitest';
import type { Lease } from '@truelinks/shared';
import { sampleLeaseRecords } from '../sampleLeaseRecords.ts';
import { acceptAllFields } from './patchRecord.ts';
import { listPendingItems, highSeverityFailures } from './pendingItems.ts';

const SAMPLE_RECORD = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;
const NOW = '2026-10-05T12:00:00.000Z';

function createLease(overrides: Partial<Lease> = {}): Lease {
  return {
    id: 'lease-1',
    conversationId: 'conv-1',
    unitId: 'MC-B-1204',
    record: SAMPLE_RECORD,
    flags: [],
    ruleResults: [],
    rulesetVersion: '1.0',
    status: 'draft',
    analysisStatus: 'done',
    overrideReason: null,
    confirmedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('pendingItems', () => {
  it('lists reasons when confirmation is blocked', () => {
    const lease = createLease({
      unitId: null,
      analysisStatus: 'pending',
      flags: [
        {
          id: 'flag-1',
          code: 'CURRENCY_MISSING',
          severity: 'high',
          message: 'Currency not stated',
          fieldPaths: ['currency'],
          clauseIds: [],
          reviewStatus: 'open',
        },
        {
          id: 'flag-2',
          code: 'DISMISSED_FLAG',
          severity: 'low',
          message: 'Some dismissed note',
          fieldPaths: [],
          clauseIds: [],
          reviewStatus: 'dismissed',
        },
      ],
    });

    const items = listPendingItems(lease);
    expect(items).toContain('Analysis still pending');
    expect(items).toContain('Unit not confirmed');
    expect(items).toContain('Open flag: Currency not stated');
    expect(items).not.toContain('Open flag: Some dismissed note');
    expect(items).toContain('20 fields not reviewed — use Accept all');
  });

  it('returns empty list when all criteria are satisfied', () => {
    const { record } = acceptAllFields(SAMPLE_RECORD, [], NOW);
    const lease = createLease({
      unitId: 'MC-B-1204',
      analysisStatus: 'done',
      record,
      flags: [],
    });

    expect(listPendingItems(lease)).toEqual([]);
  });

  it('filters highSeverityFailures correctly', () => {
    const lease = createLease({
      ruleResults: [
        {
          ruleId: 'R1',
          status: 'FAIL',
          severity: 'high',
          reason: 'Rent mismatch',
          clauseIds: ['2'],
          rulesetVersion: '1.0',
        },
        {
          ruleId: 'R2',
          status: 'FAIL',
          severity: 'medium',
          reason: 'Escalation undefined',
          clauseIds: ['4'],
          rulesetVersion: '1.0',
        },
        {
          ruleId: 'R3',
          status: 'PASS',
          severity: 'high',
          reason: 'Term valid',
          clauseIds: ['1'],
          rulesetVersion: '1.0',
        },
        {
          ruleId: 'R4',
          status: 'NOT_DETERMINABLE',
          severity: 'high',
          reason: 'Missing data',
          clauseIds: [],
          rulesetVersion: '1.0',
        },
      ],
    });

    const highFails = highSeverityFailures(lease);
    expect(highFails).toHaveLength(1);
    expect(highFails[0]?.ruleId).toBe('R1');
  });
});
