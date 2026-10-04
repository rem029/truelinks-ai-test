import type { LeaseRecord, SourcedField } from '@truelinks/shared';

export function formatMoney(amount: number, currency: string | null): string {
  const formatted = amount.toLocaleString('en-US');
  return currency ? `${currency} ${formatted}` : formatted;
}

export function getClauseIds(...fields: (SourcedField | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const f of fields) {
    if (f?.source?.type === 'document' && f.source.clauseId) {
      ids.add(f.source.clauseId);
    }
  }
  return Array.from(ids);
}

export interface LeaseFieldEntry {
  fieldPath: string;
  field: SourcedField;
}

// One walk over the record, so per-field checks don't each hard-code the field list
export function listFields(record: LeaseRecord): LeaseFieldEntry[] {
  return [
    { fieldPath: 'landlord.name', field: record.landlord.name },
    { fieldPath: 'landlord.signed', field: record.landlord.signed },
    { fieldPath: 'tenant.name', field: record.tenant.name },
    { fieldPath: 'tenant.signed', field: record.tenant.signed },
    { fieldPath: 'unit.unitId', field: record.unit.unitId },
    { fieldPath: 'unit.label', field: record.unit.label },
    { fieldPath: 'unit.parkingBay', field: record.unit.parkingBay },
    { fieldPath: 'commencementDate', field: record.commencementDate },
    { fieldPath: 'expiryDate', field: record.expiryDate },
    { fieldPath: 'termMonths', field: record.termMonths },
    { fieldPath: 'rent.amount', field: record.rent.amount },
    { fieldPath: 'rent.frequency', field: record.rent.frequency },
    { fieldPath: 'rent.monthly', field: record.rent.monthly },
    { fieldPath: 'rent.annual', field: record.rent.annual },
    { fieldPath: 'currency', field: record.currency },
    { fieldPath: 'deposit', field: record.deposit },
    { fieldPath: 'escalation.text', field: record.escalation.text },
    { fieldPath: 'escalation.isDefined', field: record.escalation.isDefined },
    { fieldPath: 'renewal', field: record.renewal },
    { fieldPath: 'termination', field: record.termination },
  ];
}
