import { describe, it, expect } from 'vitest';
import type { LeaseRecord } from '@truelinks/shared';
import { monthlyRent, compareAnnualRent } from './rent.ts';

function createMockRent(overrides: Partial<{
  amount: number | null;
  frequency: 'monthly' | 'quarterly' | 'annual' | null;
  monthly: number | null;
  annual: number | null;
}> = {}): LeaseRecord['rent'] {
  const dummySource = { type: 'document' as const, clauseId: '2', quote: 'rent', verified: true };
  const dummyReview = { status: 'pending' as const };

  return {
    amount: { value: overrides.amount ?? null, source: dummySource, confidence: 1, review: dummyReview },
    frequency: { value: overrides.frequency ?? null, source: dummySource, confidence: 1, review: dummyReview },
    monthly: { value: overrides.monthly ?? null, source: dummySource, confidence: 1, review: dummyReview },
    annual: { value: overrides.annual ?? null, source: dummySource, confidence: 1, review: dummyReview },
  };
}

describe('monthlyRent', () => {
  it('returns stated monthly rent when present (not derived)', () => {
    const rent = createMockRent({
      amount: 9500,
      frequency: 'monthly',
      monthly: 9500,
    });
    expect(monthlyRent(rent)).toEqual({ value: 9500, derived: false });
  });

  it('derives monthly rent when frequency is monthly and stated monthly is null', () => {
    const rent = createMockRent({
      amount: 8500,
      frequency: 'monthly',
      monthly: null,
    });
    expect(monthlyRent(rent)).toEqual({ value: 8500, derived: true });
  });

  it('derives monthly rent from quarterly amount', () => {
    const rent = createMockRent({
      amount: 39000,
      frequency: 'quarterly',
      monthly: null,
    });
    expect(monthlyRent(rent)).toEqual({ value: 13000, derived: true });
  });

  it('derives monthly rent from annual amount', () => {
    const rent = createMockRent({
      amount: 120000,
      frequency: 'annual',
      monthly: null,
    });
    expect(monthlyRent(rent)).toEqual({ value: 10000, derived: true });
  });

  it('returns null when monthly is missing and amount or frequency cannot be determined', () => {
    expect(monthlyRent(createMockRent({ monthly: null, amount: null, frequency: 'monthly' }))).toBeNull();
    expect(monthlyRent(createMockRent({ monthly: null, amount: 9500, frequency: null }))).toBeNull();
    expect(monthlyRent(createMockRent({ monthly: null, amount: null, frequency: null }))).toBeNull();
  });
});

describe('compareAnnualRent', () => {
  it('returns reconciled when annual reconciles with monthly x 12 within 1 tolerance', () => {
    const rent = createMockRent({
      amount: 9500,
      frequency: 'monthly',
      monthly: 9500,
      annual: 114000,
    });
    expect(compareAnnualRent(rent)).toEqual({
      status: 'reconciled',
      stated: 114000,
      monthly: 9500,
      expected: 114000,
    });
  });

  it('detects mismatch when stated annual diverges from monthly x 12', () => {
    const rent = createMockRent({
      amount: 6200,
      frequency: 'monthly',
      monthly: 6200,
      annual: 72000, // 6200 * 12 = 74400
    });
    expect(compareAnnualRent(rent)).toEqual({
      status: 'mismatch',
      stated: 72000,
      monthly: 6200,
      expected: 74400,
    });
  });

  it('returns not_determinable when stated annual or monthly is missing', () => {
    const missingAnnual = createMockRent({ monthly: 9500, annual: null });
    expect(compareAnnualRent(missingAnnual)).toEqual({ status: 'not_determinable' });

    const missingMonthly = createMockRent({ monthly: null, amount: null, annual: 114000 });
    expect(compareAnnualRent(missingMonthly)).toEqual({ status: 'not_determinable' });
  });
});
