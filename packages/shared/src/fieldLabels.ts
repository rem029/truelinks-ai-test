// Shared so the UI and the thread messages the API writes name fields the same way
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
