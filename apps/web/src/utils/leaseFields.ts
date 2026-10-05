import type { LeaseRecord, SourcedField } from '@truelinks/shared';

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

export function getFieldFromRecord(record: LeaseRecord, path: FieldPath): SourcedField {
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

export interface LeaseFieldItem {
  path: FieldPath;
  field: SourcedField;
}

export function listAllFields(record: LeaseRecord): LeaseFieldItem[] {
  return FIELD_PATHS.map((path) => ({
    path,
    field: getFieldFromRecord(record, path),
  }));
}
