import { describe, it, expect } from 'vitest';
import type { LeaseRecord, Unit } from '@truelinks/shared';
import { matchUnit, unitNotFoundReason } from './unitMatch.ts';
import { sampleLeaseRecords } from './sampleLeaseRecords.ts';
import { loadUnits } from '../../db/seed.ts';

const mockUnits = loadUnits();

function createMockRecord(unit: {
  unitId?: string | null;
  label?: string | null;
  parkingBay?: string | null;
}): LeaseRecord {
  const dummySource = { type: 'document' as const, clauseId: 'premises', quote: 'test', verified: true };
  const dummyReview = { status: 'pending' as const };

  return {
    landlord: {
      name: { value: 'Landlord', source: dummySource, confidence: 1, review: dummyReview },
      signed: { value: true, source: dummySource, confidence: 1, review: dummyReview },
    },
    tenant: {
      name: { value: 'Tenant', source: dummySource, confidence: 1, review: dummyReview },
      signed: { value: true, source: dummySource, confidence: 1, review: dummyReview },
    },
    unit: {
      unitId: { value: unit.unitId ?? null, source: dummySource, confidence: 1, review: dummyReview },
      label: { value: unit.label ?? null, source: dummySource, confidence: 1, review: dummyReview },
      parkingBay: { value: unit.parkingBay ?? null, source: dummySource, confidence: 1, review: dummyReview },
    },
    commencementDate: { value: '2026-11-01', source: dummySource, confidence: 1, review: dummyReview },
    expiryDate: { value: '2028-10-31', source: dummySource, confidence: 1, review: dummyReview },
    termMonths: { value: 24, source: dummySource, confidence: 1, review: dummyReview },
    rent: {
      amount: { value: 9500, source: dummySource, confidence: 1, review: dummyReview },
      frequency: { value: 'monthly', source: dummySource, confidence: 1, review: dummyReview },
      monthly: { value: 9500, source: dummySource, confidence: 1, review: dummyReview },
      annual: { value: 114000, source: dummySource, confidence: 1, review: dummyReview },
    },
    currency: { value: 'QAR', source: dummySource, confidence: 1, review: dummyReview },
    deposit: { value: 9500, source: dummySource, confidence: 1, review: dummyReview },
    escalation: {
      text: { value: '5%', source: dummySource, confidence: 1, review: dummyReview },
      isDefined: { value: true, source: dummySource, confidence: 1, review: dummyReview },
    },
    renewal: { value: 'terms', source: dummySource, confidence: 1, review: dummyReview },
    termination: { value: 'terms', source: dummySource, confidence: 1, review: dummyReview },
  };
}

describe('matchUnit', () => {
  it('matches by exact unitId (case-insensitive, trimmed)', () => {
    const record = createMockRecord({ unitId: '  mc-b-1204 ' });
    const match = matchUnit(record, mockUnits);
    expect(match).toEqual({
      status: 'matched',
      unit: mockUnits.find((u) => u.unitId === 'MC-B-1204'),
    });
  });

  it('returns unconfirmed when stated unitId is unknown in owner records', () => {
    const record = createMockRecord({ unitId: 'UNKNOWN-ID' });
    const match = matchUnit(record, mockUnits);
    expect(match.status).toBe('unconfirmed');
    if (match.status === 'unconfirmed') {
      expect(match.statedUnitId).toBe('UNKNOWN-ID');
      expect(match.suggestions).toEqual([]);
    }
  });

  it('returns unconfirmed with MC-B-0902 suggested for lease 02', () => {
    const record = sampleLeaseRecords['lease-02-problems-MC-B-0902.pdf']!;
    const match = matchUnit(record, mockUnits);
    expect(match.status).toBe('unconfirmed');
    if (match.status === 'unconfirmed') {
      expect(match.statedUnitId).toBeNull();
      expect(match.suggestions.map((u) => u.unitId)).toEqual(['MC-B-0902']);
    }
  });

  it('suggests MC-B-1204 for full premises text with no unit ID', () => {
    const record = createMockRecord({
      unitId: null,
      label: 'Apartment 1204, Tower B, Marina Crest Residences, Lusail Marina District, Doha',
    });
    const match = matchUnit(record, mockUnits);
    expect(match.status).toBe('unconfirmed');
    if (match.status === 'unconfirmed') {
      expect(match.suggestions.map((u) => u.unitId)).toContain('MC-B-1204');
    }
  });

  it('suggests page unit first in the suggestions list', () => {
    const record = createMockRecord({
      unitId: null,
      label: 'Apartment 0902',
    });
    const match = matchUnit(record, mockUnits, 'MC-A-0301');
    expect(match.status).toBe('unconfirmed');
    if (match.status === 'unconfirmed') {
      expect(match.suggestions[0]?.unitId).toBe('MC-A-0301');
      expect(match.suggestions.map((u) => u.unitId)).toContain('MC-B-0902');
    }
  });

  it('returns unconfirmed with no suggestions for lease 05', () => {
    const record = sampleLeaseRecords['lease-05-unknown-unit-rent-conflict.pdf']!;
    const match = matchUnit(record, mockUnits);
    expect(match).toEqual({
      status: 'unconfirmed',
      statedUnitId: null,
      suggestions: [],
    });
  });
});

describe('unitNotFoundReason', () => {
  it('formats reason with stated unitId when present', () => {
    const record = createMockRecord({ unitId: 'UNKNOWN-ID', label: 'Apartment 1501' });
    expect(unitNotFoundReason(record, 'UNKNOWN-ID')).toBe("Unit ID 'UNKNOWN-ID' not in owner records");
  });

  it('formats reason with label when unitId is absent', () => {
    const record = createMockRecord({ unitId: null, label: 'Apartment 1501, Tower C' });
    expect(unitNotFoundReason(record, null)).toBe("Unit 'Apartment 1501, Tower C' not in owner records");
  });

  it('falls back when both unitId and label are absent', () => {
    const record = createMockRecord({ unitId: null, label: null });
    expect(unitNotFoundReason(record, null)).toBe('Unit not identified in the lease');
  });
});
