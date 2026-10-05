import { describe, it, expect } from 'vitest';
import type { Flag } from '@truelinks/shared';
import { sampleLeaseRecords } from '../sampleLeaseRecords.ts';
import { acceptField, editField } from './patchRecord.ts';
import { mergeFlags } from './mergeFlags.ts';

const SAMPLE = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;
const NOW = '2026-10-05T12:00:00.000Z';

describe('mergeFlags', () => {
  it('carries reviewStatus by id from previous flag to fresh flag', () => {
    const previous: Flag[] = [
      {
        id: 'UNVERIFIED_QUOTE:tenant.name',
        code: 'UNVERIFIED_QUOTE',
        severity: 'medium',
        message: 'Quote not found',
        fieldPaths: ['tenant.name'],
        clauseIds: ['parties'],
        reviewStatus: 'dismissed',
      },
    ];

    const fresh: Flag[] = [
      {
        id: 'UNVERIFIED_QUOTE:tenant.name',
        code: 'UNVERIFIED_QUOTE',
        severity: 'medium',
        message: 'Quote not found',
        fieldPaths: ['tenant.name'],
        clauseIds: ['parties'],
        reviewStatus: 'open',
      },
    ];

    const merged = mergeFlags(previous, fresh, SAMPLE);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('UNVERIFIED_QUOTE:tenant.name');
    expect(merged[0]?.reviewStatus).toBe('dismissed');
  });

  it('keeps VALUE_CONFLICT until all its referenced fields are locked, then drops it', () => {
    const conflictFlag: Flag = {
      id: 'VALUE_CONFLICT:rent.amount',
      code: 'VALUE_CONFLICT',
      severity: 'high',
      message: 'Monthly rent conflict: clause 2 says 9,500, clause 5 says 9,000',
      fieldPaths: ['rent.amount', 'rent.monthly'],
      clauseIds: ['2', '5'],
      reviewStatus: 'open',
    };

    const previous: Flag[] = [conflictFlag];
    const fresh: Flag[] = [];

    // Initially, both fields are pending -> kept
    const initialMerged = mergeFlags(previous, fresh, SAMPLE);
    expect(initialMerged).toHaveLength(1);
    expect(initialMerged[0]?.id).toBe('VALUE_CONFLICT:rent.amount');

    // Only rent.amount accepted -> still kept because rent.monthly is pending
    const partialRecord = acceptField(SAMPLE, 'rent.amount', NOW);
    const partialMerged = mergeFlags(previous, fresh, partialRecord);
    expect(partialMerged).toHaveLength(1);

    // Both rent.amount and rent.monthly locked -> resolved and dropped
    const lockedRecord = editField(partialRecord, 'rent.monthly', '9,500', 'msg-1', NOW);
    const finalMerged = mergeFlags(previous, fresh, lockedRecord);
    expect(finalMerged).toHaveLength(0);
  });

  it('keeps MODEL_CONCERN and ANALYSIS_FAILED from previous', () => {
    const modelConcern: Flag = {
      id: 'MODEL_CONCERN:renewal',
      code: 'MODEL_CONCERN',
      severity: 'medium',
      message: 'Renewal terms vague',
      fieldPaths: ['renewal'],
      clauseIds: ['7'],
      reviewStatus: 'open',
    };

    const analysisFailed: Flag = {
      id: 'ANALYSIS_FAILED',
      code: 'ANALYSIS_FAILED',
      severity: 'medium',
      message: 'Full lease review failed',
      fieldPaths: [],
      clauseIds: [],
      reviewStatus: 'open',
    };

    const previous: Flag[] = [modelConcern, analysisFailed];
    const fresh: Flag[] = [];

    const merged = mergeFlags(previous, fresh, SAMPLE);
    expect(merged).toHaveLength(2);
    expect(merged.map((f) => f.code)).toEqual(['MODEL_CONCERN', 'ANALYSIS_FAILED']);
  });

  it('drops MISSING_FIELD when not present in fresh flags', () => {
    const previous: Flag[] = [
      {
        id: 'MISSING_FIELD:landlord.name',
        code: 'MISSING_FIELD',
        severity: 'high',
        message: 'Landlord name not stated',
        fieldPaths: ['landlord.name'],
        clauseIds: [],
        reviewStatus: 'open',
      },
    ];

    const fresh: Flag[] = [];

    const merged = mergeFlags(previous, fresh, SAMPLE);
    expect(merged).toHaveLength(0);
  });

  it('orders fresh flags first, then kept flags, with no duplicate ids', () => {
    const freshFlag: Flag = {
      id: 'CURRENCY_MISSING',
      code: 'CURRENCY_MISSING',
      severity: 'high',
      message: 'Currency missing',
      fieldPaths: ['currency'],
      clauseIds: [],
      reviewStatus: 'open',
    };

    const keptFlag: Flag = {
      id: 'ANALYSIS_FAILED',
      code: 'ANALYSIS_FAILED',
      severity: 'medium',
      message: 'Analysis failed',
      fieldPaths: [],
      clauseIds: [],
      reviewStatus: 'open',
    };

    const previous: Flag[] = [
      keptFlag,
      { ...freshFlag, reviewStatus: 'dismissed' },
    ];
    const fresh: Flag[] = [freshFlag];

    const merged = mergeFlags(previous, fresh, SAMPLE);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.id).toBe('CURRENCY_MISSING');
    expect(merged[0]?.reviewStatus).toBe('dismissed');
    expect(merged[1]?.id).toBe('ANALYSIS_FAILED');
  });
});
