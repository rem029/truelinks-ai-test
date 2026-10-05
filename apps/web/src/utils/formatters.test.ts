import { describe, it, expect } from 'vitest';
import {
  getFieldLabel,
  formatFieldValue,
  parseFieldValue,
  formatElapsedSeconds,
  formatTokens,
  formatShortDate,
} from './formatters.ts';

describe('formatters', () => {
  it('returns human-friendly field labels', () => {
    expect(getFieldLabel('landlord.name')).toBe('Landlord Name');
    expect(getFieldLabel('rent.monthly')).toBe('Monthly Rent');
    expect(getFieldLabel('commencementDate')).toBe('Commencement Date');
    expect(getFieldLabel('custom.unknownField')).toBe('Custom · UnknownField');
  });

  it('formats field values correctly', () => {
    expect(formatFieldValue('rent.amount', 8500)).toBe('8,500');
    expect(formatFieldValue('landlord.signed', true)).toBe('Yes');
    expect(formatFieldValue('landlord.signed', false)).toBe('No');
    expect(formatFieldValue('termMonths', 12)).toBe('12');
    expect(formatFieldValue('tenant.name', 'Acme Corp')).toBe('Acme Corp');
    expect(formatFieldValue('tenant.name', null)).toBe('—');
    expect(formatFieldValue('tenant.name', '')).toBe('—');
  });

  it('parses input back to proper types for editing', () => {
    expect(parseFieldValue('landlord.signed', 'true')).toBe(true);
    expect(parseFieldValue('landlord.signed', 'Yes')).toBe(true);
    expect(parseFieldValue('landlord.signed', 'false')).toBe(false);
    expect(parseFieldValue('rent.amount', '8,500')).toBe(8500);
    expect(parseFieldValue('termMonths', '24')).toBe(24);
    expect(parseFieldValue('tenant.name', '  Jane Doe  ')).toBe('Jane Doe');
  });

  it('formats elapsed seconds', () => {
    expect(formatElapsedSeconds(5)).toBe('5s');
    expect(formatElapsedSeconds(65)).toBe('1m 05s');
  });

  it('formats tokens count', () => {
    expect(formatTokens(1500)).toBe('1,500 tokens');
  });

  it('formats short date for timestamps', () => {
    const formatted = formatShortDate('2026-10-20T14:30:00.000Z');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});

