import { describe, it, expect } from 'vitest';
import { FIELD_PATHS, isFieldPath, listAllFields, getFieldFromRecord } from './leaseFields.ts';
import type { LeaseRecord } from '@truelinks/shared';

describe('leaseFields', () => {
  const dummyField = {
    value: null,
    source: null,
    confidence: 1,
    review: { status: 'pending' as const },
  };

  const dummyRecord: LeaseRecord = {
    landlord: { name: dummyField, signed: dummyField },
    tenant: { name: dummyField, signed: dummyField },
    unit: { unitId: dummyField, label: dummyField, parkingBay: dummyField },
    commencementDate: dummyField,
    expiryDate: dummyField,
    termMonths: dummyField,
    rent: {
      amount: dummyField,
      frequency: dummyField,
      monthly: dummyField,
      annual: dummyField,
    },
    currency: dummyField,
    deposit: dummyField,
    escalation: { text: dummyField, isDefined: dummyField },
    renewal: dummyField,
    termination: dummyField,
  };

  it('contains exactly 20 field paths', () => {
    expect(FIELD_PATHS).toHaveLength(20);
  });

  it('validates field path membership', () => {
    expect(isFieldPath('rent.monthly')).toBe(true);
    expect(isFieldPath('landlord.name')).toBe(true);
    expect(isFieldPath('invalid.path')).toBe(false);
  });

  it('lists all 20 fields from a record', () => {
    const fields = listAllFields(dummyRecord);
    expect(fields).toHaveLength(20);
    expect(fields.map((f) => f.path)).toEqual([...FIELD_PATHS]);
  });

  it('retrieves specific field from record', () => {
    const recordWithVal: LeaseRecord = {
      ...dummyRecord,
      tenant: {
        ...dummyRecord.tenant,
        name: { ...dummyField, value: 'John Smith' },
      },
    };
    expect(getFieldFromRecord(recordWithVal, 'tenant.name').value).toBe('John Smith');
  });
});
