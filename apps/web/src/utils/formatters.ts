const LABELS: Record<string, string> = {
  'landlord.name': 'Landlord Name',
  'landlord.signed': 'Landlord Signed',
  'tenant.name': 'Tenant Name',
  'tenant.signed': 'Tenant Signed',
  'unit.unitId': 'Unit ID',
  'unit.label': 'Unit Label',
  'unit.parkingBay': 'Parking Bay',
  commencementDate: 'Commencement Date',
  expiryDate: 'Expiry Date',
  termMonths: 'Term (Months)',
  'rent.amount': 'Rent Amount',
  'rent.frequency': 'Rent Frequency',
  'rent.monthly': 'Monthly Rent',
  'rent.annual': 'Annual Rent',
  currency: 'Currency',
  deposit: 'Security Deposit',
  'escalation.text': 'Escalation Clause',
  'escalation.isDefined': 'Escalation Defined',
  renewal: 'Renewal Clause',
  termination: 'Termination Clause',
};

export function getFieldLabel(path: string): string {
  if (LABELS[path]) {
    return LABELS[path];
  }
  // Fallback: capitalize segments
  return path
    .split('.')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join(' · ');
}

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

