import { z } from 'zod';
import { LeaseRecord, RentFrequency, type SourcedField } from '@truelinks/shared';

export const FIELD_PATHS = [
  'landlord.name',
  'landlord.signed',
  'tenant.name',
  'tenant.signed',
  'unit.unitId',
  'unit.label',
  'unit.parkingBay',
  'commencementDate',
  'expiryDate',
  'termMonths',
  'rent.amount',
  'rent.frequency',
  'rent.monthly',
  'rent.annual',
  'currency',
  'deposit',
  'escalation.text',
  'escalation.isDefined',
  'renewal',
  'termination',
] as const;

export type FieldPath = (typeof FIELD_PATHS)[number];

const FIELD_PATH_SET = new Set<string>(FIELD_PATHS);

export function isFieldPath(s: string): s is FieldPath {
  return FIELD_PATH_SET.has(s);
}

export const FIELD_VALUE_SCHEMAS: Record<FieldPath, z.ZodTypeAny> = {
  'landlord.name': z.string(),
  'landlord.signed': z.boolean(),
  'tenant.name': z.string(),
  'tenant.signed': z.boolean(),
  'unit.unitId': z.string(),
  'unit.label': z.string(),
  'unit.parkingBay': z.string(),
  commencementDate: z.iso.date(),
  expiryDate: z.iso.date(),
  termMonths: z.number(),
  'rent.amount': z.number(),
  'rent.frequency': RentFrequency,
  'rent.monthly': z.number(),
  'rent.annual': z.number(),
  currency: z.string(),
  deposit: z.number(),
  'escalation.text': z.string(),
  'escalation.isDefined': z.boolean(),
  renewal: z.string(),
  termination: z.string(),
};

export function getField(record: LeaseRecord, path: FieldPath): SourcedField {
  switch (path) {
    case 'landlord.name':
      return record.landlord.name;
    case 'landlord.signed':
      return record.landlord.signed;
    case 'tenant.name':
      return record.tenant.name;
    case 'tenant.signed':
      return record.tenant.signed;
    case 'unit.unitId':
      return record.unit.unitId;
    case 'unit.label':
      return record.unit.label;
    case 'unit.parkingBay':
      return record.unit.parkingBay;
    case 'commencementDate':
      return record.commencementDate;
    case 'expiryDate':
      return record.expiryDate;
    case 'termMonths':
      return record.termMonths;
    case 'rent.amount':
      return record.rent.amount;
    case 'rent.frequency':
      return record.rent.frequency;
    case 'rent.monthly':
      return record.rent.monthly;
    case 'rent.annual':
      return record.rent.annual;
    case 'currency':
      return record.currency;
    case 'deposit':
      return record.deposit;
    case 'escalation.text':
      return record.escalation.text;
    case 'escalation.isDefined':
      return record.escalation.isDefined;
    case 'renewal':
      return record.renewal;
    case 'termination':
      return record.termination;
  }
}

export function setField(record: LeaseRecord, path: FieldPath, field: SourcedField): LeaseRecord {
  const clone = structuredClone(record) as Record<string, unknown>;
  const parts = path.split('.');
  let current = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = parts[parts.length - 1]!;
  current[lastKey] = field;
  return LeaseRecord.parse(clone);
}

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
  fieldPath: FieldPath;
  field: SourcedField;
}

// One walk over the record, derived from FIELD_PATHS + getField
export function listFields(record: LeaseRecord): LeaseFieldEntry[] {
  return FIELD_PATHS.map((fieldPath) => ({
    fieldPath,
    field: getField(record, fieldPath),
  }));
}
