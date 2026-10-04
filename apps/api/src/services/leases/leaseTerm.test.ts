import { describe, it, expect } from 'vitest';
import { monthsBetween } from './leaseTerm.ts';

describe('monthsBetween', () => {
  it('calculates 24 months for 2026-11-01 to 2028-10-31', () => {
    expect(monthsBetween('2026-11-01', '2028-10-31')).toBe(24);
  });

  it('calculates 12 months for 2026-11-15 to 2027-11-14', () => {
    expect(monthsBetween('2026-11-15', '2027-11-14')).toBe(12);
  });

  it('calculates 18 months for 2026-12-01 to 2028-05-31', () => {
    expect(monthsBetween('2026-12-01', '2028-05-31')).toBe(18);
  });

  it('returns null when the span is not a whole number of months', () => {
    expect(monthsBetween('2026-11-01', '2027-11-15')).toBeNull();
    expect(monthsBetween('2026-11-15', '2027-11-10')).toBeNull();
  });

  it('returns null when expiry is before or equal to commencement', () => {
    expect(monthsBetween('2028-10-31', '2026-11-01')).toBeNull();
    expect(monthsBetween('2026-11-01', '2026-11-01')).toBeNull();
  });

  it('handles month-end and leap-year cases correctly (2028-02-29)', () => {
    // 2028 is a leap year; 2027-03-01 to 2028-02-29 is a 12-month term
    expect(monthsBetween('2027-03-01', '2028-02-29')).toBe(12);
    // 2028-02-01 to 2028-02-29 is a 1-month term
    expect(monthsBetween('2028-02-01', '2028-02-29')).toBe(1);
  });
});
