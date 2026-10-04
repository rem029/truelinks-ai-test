import { describe, it, expect } from 'vitest';
import { LeaseRecord } from './lease.js';

describe('LeaseRecord schema', () => {
  it('parses a complete valid lease record', () => {
    const raw = {
      landlord: {
        name: { value: 'Marina Crest Holdings', source: null, confidence: 1, review: { status: 'pending' } },
        signed: { value: true, source: null, confidence: 1, review: { status: 'pending' } },
      },
      tenant: {
        name: { value: 'John Doe', source: null, confidence: 1, review: { status: 'pending' } },
        signed: { value: true, source: null, confidence: 1, review: { status: 'pending' } },
      },
      unit: {
        unitId: { value: 'MC-B-1204', source: null, confidence: 1, review: { status: 'pending' } },
        label: { value: 'Apartment 1204', source: null, confidence: 1, review: { status: 'pending' } },
        parkingBay: { value: 'B-77', source: null, confidence: 1, review: { status: 'pending' } },
      },
      commencementDate: { value: '2026-11-01', source: null, confidence: 1, review: { status: 'pending' } },
      expiryDate: { value: '2027-10-31', source: null, confidence: 1, review: { status: 'pending' } },
      termMonths: { value: 12, source: null, confidence: 1, review: { status: 'pending' } },
      rent: {
        amount: { value: 8500, source: null, confidence: 1, review: { status: 'pending' } },
        frequency: { value: 'monthly', source: null, confidence: 1, review: { status: 'pending' } },
        monthly: { value: 8500, source: null, confidence: 1, review: { status: 'pending' } },
        annual: { value: 102000, source: null, confidence: 1, review: { status: 'pending' } },
      },
      currency: { value: 'QAR', source: null, confidence: 1, review: { status: 'pending' } },
      deposit: { value: 8500, source: null, confidence: 1, review: { status: 'pending' } },
      escalation: {
        text: { value: '5% annually', source: null, confidence: 1, review: { status: 'pending' } },
        isDefined: { value: true, source: null, confidence: 1, review: { status: 'pending' } },
      },
      renewal: { value: '60 days notice', source: null, confidence: 1, review: { status: 'pending' } },
      termination: { value: '30 days notice', source: null, confidence: 1, review: { status: 'pending' } },
    };

    const parsed = LeaseRecord.parse(raw);
    expect(parsed.landlord.name.value).toBe('Marina Crest Holdings');
    expect(parsed.rent.frequency.value).toBe('monthly');
  });

  it('rejects invalid date format in commencementDate', () => {
    const raw = {
      landlord: {
        name: { value: 'Marina Crest Holdings', source: null, confidence: 1, review: { status: 'pending' } },
        signed: { value: true, source: null, confidence: 1, review: { status: 'pending' } },
      },
      tenant: {
        name: { value: 'John Doe', source: null, confidence: 1, review: { status: 'pending' } },
        signed: { value: true, source: null, confidence: 1, review: { status: 'pending' } },
      },
      unit: {
        unitId: { value: 'MC-B-1204', source: null, confidence: 1, review: { status: 'pending' } },
        label: { value: 'Apartment 1204', source: null, confidence: 1, review: { status: 'pending' } },
        parkingBay: { value: 'B-77', source: null, confidence: 1, review: { status: 'pending' } },
      },
      commencementDate: { value: '01/11/2026', source: null, confidence: 1, review: { status: 'pending' } },
      expiryDate: { value: '2027-10-31', source: null, confidence: 1, review: { status: 'pending' } },
      termMonths: { value: 12, source: null, confidence: 1, review: { status: 'pending' } },
      rent: {
        amount: { value: 8500, source: null, confidence: 1, review: { status: 'pending' } },
        frequency: { value: 'monthly', source: null, confidence: 1, review: { status: 'pending' } },
        monthly: { value: 8500, source: null, confidence: 1, review: { status: 'pending' } },
        annual: { value: 102000, source: null, confidence: 1, review: { status: 'pending' } },
      },
      currency: { value: 'QAR', source: null, confidence: 1, review: { status: 'pending' } },
      deposit: { value: 8500, source: null, confidence: 1, review: { status: 'pending' } },
      escalation: {
        text: { value: '5% annually', source: null, confidence: 1, review: { status: 'pending' } },
        isDefined: { value: true, source: null, confidence: 1, review: { status: 'pending' } },
      },
      renewal: { value: '60 days notice', source: null, confidence: 1, review: { status: 'pending' } },
      termination: { value: '30 days notice', source: null, confidence: 1, review: { status: 'pending' } },
    };

    expect(() => LeaseRecord.parse(raw)).toThrow();
  });
});
