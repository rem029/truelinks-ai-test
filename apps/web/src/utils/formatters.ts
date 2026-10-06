export { getFieldLabel } from '@truelinks/shared';

export function formatFieldValue(path: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    if (path.includes('rent') || path === 'deposit') {
      return value.toLocaleString('en-US');
    }
    return String(value);
  }
  return String(value);
}

const BOOLEAN_PATHS = new Set(['landlord.signed', 'tenant.signed', 'escalation.isDefined']);
const NUMBER_PATHS = new Set([
  'termMonths',
  'rent.amount',
  'rent.monthly',
  'rent.annual',
  'deposit',
]);

export function parseFieldValue(path: string, input: string): unknown {
  const trimmed = input.trim();
  if (BOOLEAN_PATHS.has(path)) {
    return trimmed.toLowerCase() === 'true' || trimmed.toLowerCase() === 'yes';
  }
  if (NUMBER_PATHS.has(path)) {
    const cleaned = trimmed.replace(/,/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? trimmed : num;
  }
  return trimmed;
}

export function formatElapsedSeconds(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export function formatTokens(tokens: number): string {
  return `${tokens.toLocaleString('en-US')} tokens`;
}

export function formatShortDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}


// Lease dates are calendar dates (yyyy-mm-dd), shown without a time zone shift
export function formatLeaseDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Whole calendar months from one date to another, counting a part month as one
export function monthsBetweenDates(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) +
    (to.getUTCDate() >= from.getUTCDate() ? 1 : 0);
  return Math.max(months, 0);
}

export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return '—';
  return `${currency ?? ''} ${amount.toLocaleString('en-US')}`.trim();
}
