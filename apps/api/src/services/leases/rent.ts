import type { LeaseRecord } from '@truelinks/shared';

export interface MonthlyRentResult {
  value: number;
  derived: boolean;
}

export function monthlyRent(rent: LeaseRecord['rent']): MonthlyRentResult | null {
  if (rent.monthly.value !== null) {
    return { value: rent.monthly.value, derived: false };
  }

  const amount = rent.amount.value;
  const frequency = rent.frequency.value;
  if (amount === null || frequency === null) {
    return null;
  }

  switch (frequency) {
    case 'monthly':
      return { value: amount, derived: true };
    case 'quarterly':
      return { value: amount / 3, derived: true };
    case 'annual':
      return { value: amount / 12, derived: true };
  }
}

export type AnnualRentComparison =
  | { status: 'reconciled'; stated: number; monthly: number; expected: number }
  | { status: 'mismatch'; stated: number; monthly: number; expected: number }
  | { status: 'not_determinable' };

export function compareAnnualRent(rent: LeaseRecord['rent']): AnnualRentComparison {
  const monthlyInfo = monthlyRent(rent);
  const stated = rent.annual.value;

  if (stated === null || monthlyInfo === null) {
    return { status: 'not_determinable' };
  }

  const monthly = monthlyInfo.value;
  const expected = monthly * 12;

  // Allow 1 currency unit tolerance for quarterly/fractional roundings
  if (Math.abs(stated - expected) <= 1) {
    return { status: 'reconciled', stated, monthly, expected };
  }

  return { status: 'mismatch', stated, monthly, expected };
}
