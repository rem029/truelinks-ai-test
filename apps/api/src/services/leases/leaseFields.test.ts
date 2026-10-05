import { describe, it, expect } from 'vitest';
import { sampleLeaseRecords } from './sampleLeaseRecords.ts';
import {
  FIELD_PATHS,
  FIELD_VALUE_SCHEMAS,
  isFieldPath,
  getField,
  setField,
  listFields,
  formatMoney,
  getClauseIds,
} from './leaseFields.ts';

const SAMPLE = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;

describe('leaseFields', () => {
  it('identifies valid and invalid field paths with isFieldPath', () => {
    expect(isFieldPath('rent.amount')).toBe(true);
    expect(isFieldPath('landlord.name')).toBe(true);
    expect(isFieldPath('commencementDate')).toBe(true);
    expect(isFieldPath('unknown.field')).toBe(false);
    expect(isFieldPath('')).toBe(false);
  });

  it('exposes schemas for all 20 field paths', () => {
    expect(FIELD_PATHS).toHaveLength(20);
    for (const path of FIELD_PATHS) {
      expect(FIELD_VALUE_SCHEMAS[path]).toBeDefined();
    }
  });

  it('listFields returns 20 field entries matching record', () => {
    const fields = listFields(SAMPLE);
    expect(fields).toHaveLength(20);
    expect(fields.map((f) => f.fieldPath)).toEqual([...FIELD_PATHS]);
  });

  it('getField retrieves the expected field', () => {
    const rentField = getField(SAMPLE, 'rent.amount');
    expect(rentField.value).toBe(9500);
    expect(getField(SAMPLE, 'landlord.name').value).toBe('Marina Crest Holdings W.L.L.');
  });

  it('setField returns a new record without mutating the original', () => {
    const originalField = getField(SAMPLE, 'rent.amount');
    const updatedField = {
      ...originalField,
      value: 10000,
    };

    const newRecord = setField(SAMPLE, 'rent.amount', updatedField);

    expect(getField(newRecord, 'rent.amount').value).toBe(10000);
    // Original record must be untouched
    expect(getField(SAMPLE, 'rent.amount').value).toBe(9500);
    expect(newRecord).not.toBe(SAMPLE);
    expect(newRecord.rent).not.toBe(SAMPLE.rent);
    expect(newRecord.landlord).toEqual(SAMPLE.landlord);
  });

  it('setField fails loudly when setting an invalid value', () => {
    const invalidField = {
      ...getField(SAMPLE, 'rent.amount'),
      value: 'not-a-number' as unknown as number,
    };
    expect(() => setField(SAMPLE, 'rent.amount', invalidField)).toThrow();
  });

  it('formatMoney formats amounts with and without currency', () => {
    expect(formatMoney(9500, 'QAR')).toBe('QAR 9,500');
    expect(formatMoney(9500, null)).toBe('9,500');
  });

  it('getClauseIds extracts document clause IDs uniquely', () => {
    const ids = getClauseIds(
      SAMPLE.landlord.name,
      SAMPLE.landlord.signed,
      SAMPLE.tenant.name,
      null,
      undefined
    );
    expect(ids).toEqual(['parties', 'signatures']);
  });
});
