import { describe, it, expect } from 'vitest';
import { loadUnits } from '../db/seed.ts';
import { matchUnit } from './unitMatch.ts';
import { detectFlags } from './flags.ts';
import { sampleLeaseRecords } from './sampleLeaseRecords.ts';

const allUnits = loadUnits();

describe('detectFlags per sample lease', () => {
  it('detects no flags for lease 01 (clean)', () => {
    const record = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;
    const unitMatch = matchUnit(record, allUnits);
    const flags = detectFlags({ record, unitMatch });
    expect(flags).toHaveLength(0);
  });

  it('detects expected flag codes and messages for lease 02 (problems)', () => {
    const record = sampleLeaseRecords['lease-02-problems-MC-B-0902.pdf']!;
    const unitMatch = matchUnit(record, allUnits);
    const flags = detectFlags({ record, unitMatch });

    const codes = flags.map((f) => f.code);
    expect(codes).toEqual([
      'TERM_DATES_MISMATCH',
      'ANNUAL_RENT_MISMATCH',
      'SIGNATURE_MISSING',
      'UNIT_NOT_CONFIRMED',
    ]);

    const termFlag = flags.find((f) => f.code === 'TERM_DATES_MISMATCH');
    expect(termFlag?.message).toBe('Stated term (12 months) contradicts dates (18 months)');

    const annualFlag = flags.find((f) => f.code === 'ANNUAL_RENT_MISMATCH');
    expect(annualFlag?.message).toBe('Annual rent QAR 72,000 != QAR 6,200 x 12 (QAR 74,400)');

    const unitFlag = flags.find((f) => f.code === 'UNIT_NOT_CONFIRMED');
    expect(unitFlag?.message).toBe('Unit ID not stated; owner to confirm (suggested MC-B-0902)');

    const signatureFlag = flags.find((f) => f.code === 'SIGNATURE_MISSING');
    expect(signatureFlag?.message).toBe('Tenant signature missing');
  });

  it('detects no flags for lease 03 (occupied unit is a policy breach, not a data-quality flag)', () => {
    const record = sampleLeaseRecords['lease-03-occupied-MC-B-1205.pdf']!;
    const unitMatch = matchUnit(record, allUnits);
    const flags = detectFlags({ record, unitMatch });
    expect(flags).toHaveLength(0);
  });

  it('detects MISSING_FIELD(deposit) and RENT_DERIVED for lease 04 (quarterly)', () => {
    const record = sampleLeaseRecords['lease-04-quarterly-no-deposit-MC-A-0301.pdf']!;
    const unitMatch = matchUnit(record, allUnits);
    const flags = detectFlags({ record, unitMatch });

    const codes = flags.map((f) => f.code);
    expect(codes).toContain('MISSING_FIELD');
    expect(codes).toContain('RENT_DERIVED');
    expect(codes).toHaveLength(2);

    const missingField = flags.find((f) => f.code === 'MISSING_FIELD');
    expect(missingField?.fieldPaths).toEqual(['deposit']);
    expect(missingField?.message).toBe('Security deposit not stated');

    const derivedRent = flags.find((f) => f.code === 'RENT_DERIVED');
    expect(derivedRent?.message).toBe('Rent is quarterly (monthly derived: 13,000)');
  });

  it('detects UNIT_NOT_FOUND for lease 05 (unknown unit)', () => {
    const record = sampleLeaseRecords['lease-05-unknown-unit-rent-conflict.pdf']!;
    const unitMatch = matchUnit(record, allUnits);
    const flags = detectFlags({ record, unitMatch });

    const codes = flags.map((f) => f.code);
    expect(codes).toEqual(['UNIT_NOT_FOUND']);

    const unitNotFound = flags[0];
    expect(unitNotFound?.message).toBe("Unit 'Apartment 1501, Tower C' not in owner records");
  });

  it('detects UNIT_PAGE_MISMATCH when matched unit differs from pageUnitId', () => {
    const record = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;
    const unitMatch = matchUnit(record, allUnits);
    const flags = detectFlags({
      record,
      unitMatch,
      pageUnitId: 'MC-B-0902',
    });

    const pageMismatchFlag = flags.find((f) => f.code === 'UNIT_PAGE_MISMATCH');
    expect(pageMismatchFlag).toBeDefined();
    expect(pageMismatchFlag?.severity).toBe('high');
    expect(pageMismatchFlag?.message).toContain('MC-B-1204');
    expect(pageMismatchFlag?.message).toContain('MC-B-0902');
  });

  it('formats UNIT_NOT_CONFIRMED message when unit ID was stated but unknown in owner records', () => {
    const baseRecord = sampleLeaseRecords['lease-02-problems-MC-B-0902.pdf']!;
    const recordWithUnknownId = {
      ...baseRecord,
      unit: {
        ...baseRecord.unit,
        unitId: {
          ...baseRecord.unit.unitId,
          value: 'MC-B-9999',
        },
      },
    };
    const unitMatch = matchUnit(recordWithUnknownId, allUnits);
    expect(unitMatch.status).toBe('unconfirmed');
    const flags = detectFlags({ record: recordWithUnknownId, unitMatch });
    const unitFlag = flags.find((f) => f.code === 'UNIT_NOT_CONFIRMED');
    expect(unitFlag?.message).toBe(
      "Unit ID 'MC-B-9999' not in owner records; owner to confirm (suggested MC-B-0902)"
    );
  });
});
