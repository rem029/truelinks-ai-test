import { z } from 'zod';
import {
  type Clause,
  type Flag,
  type LeaseRecord,
  LeaseRecord as LeaseRecordSchema,
  RentFrequency,
} from '@truelinks/shared';
import type {
  ExtractedBoolean,
  ExtractedNumber,
  ExtractedText,
  LeaseExtraction,
} from './extractionSchema.ts';
import { verifyQuote } from './verifyQuote.ts';

interface FieldDef {
  fieldPath: string;
  get: (extraction: LeaseExtraction) => ExtractedText | ExtractedNumber | ExtractedBoolean;
  schema: z.ZodTypeAny;
}

const FIELD_DEFS: FieldDef[] = [
  { fieldPath: 'landlord.name', get: (e) => e.fields.landlord.name, schema: z.string() },
  { fieldPath: 'landlord.signed', get: (e) => e.fields.landlord.signed, schema: z.boolean() },
  { fieldPath: 'tenant.name', get: (e) => e.fields.tenant.name, schema: z.string() },
  { fieldPath: 'tenant.signed', get: (e) => e.fields.tenant.signed, schema: z.boolean() },
  { fieldPath: 'unit.unitId', get: (e) => e.fields.unit.unitId, schema: z.string() },
  { fieldPath: 'unit.label', get: (e) => e.fields.unit.label, schema: z.string() },
  { fieldPath: 'unit.parkingBay', get: (e) => e.fields.unit.parkingBay, schema: z.string() },
  { fieldPath: 'commencementDate', get: (e) => e.fields.commencementDate, schema: z.iso.date() },
  { fieldPath: 'expiryDate', get: (e) => e.fields.expiryDate, schema: z.iso.date() },
  { fieldPath: 'termMonths', get: (e) => e.fields.termMonths, schema: z.number() },
  { fieldPath: 'rent.amount', get: (e) => e.fields.rent.amount, schema: z.number() },
  { fieldPath: 'rent.frequency', get: (e) => e.fields.rent.frequency, schema: RentFrequency },
  { fieldPath: 'rent.monthly', get: (e) => e.fields.rent.monthly, schema: z.number() },
  { fieldPath: 'rent.annual', get: (e) => e.fields.rent.annual, schema: z.number() },
  { fieldPath: 'currency', get: (e) => e.fields.currency, schema: z.string() },
  { fieldPath: 'deposit', get: (e) => e.fields.deposit, schema: z.number() },
  { fieldPath: 'escalation.text', get: (e) => e.fields.escalation.text, schema: z.string() },
  { fieldPath: 'escalation.isDefined', get: (e) => e.fields.escalation.isDefined, schema: z.boolean() },
  { fieldPath: 'renewal', get: (e) => e.fields.renewal, schema: z.string() },
  { fieldPath: 'termination', get: (e) => e.fields.termination, schema: z.string() },
];

function setNestedField(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = parts[parts.length - 1]!;
  current[lastKey] = value;
}

export function buildLeaseRecord(
  extraction: LeaseExtraction,
  clauses: Clause[]
): { record: LeaseRecord; flags: Flag[] } {
  const flags: Flag[] = [];
  const rawRecord: Record<string, unknown> = {};

  for (const entry of FIELD_DEFS) {
    const extracted = entry.get(extraction);

    if (!extracted.found) {
      setNestedField(rawRecord, entry.fieldPath, {
        value: null,
        source: null,
        confidence: 0,
        review: { status: 'pending' },
      });
      continue;
    }

    let rawValue: unknown = extracted.value;
    if (typeof rawValue === 'string') {
      if (entry.fieldPath === 'currency') {
        rawValue = rawValue.trim().toUpperCase();
      } else if (entry.fieldPath === 'rent.frequency') {
        rawValue = rawValue.trim().toLowerCase();
      }
    }

    const parsed = entry.schema.safeParse(rawValue);
    if (!parsed.success) {
      setNestedField(rawRecord, entry.fieldPath, {
        value: null,
        source: null,
        confidence: 0,
        review: { status: 'pending' },
      });
      flags.push({
        id: `UNREADABLE_VALUE:${entry.fieldPath}`,
        code: 'UNREADABLE_VALUE',
        severity: 'medium',
        message: `Could not read ${entry.fieldPath}: "${String(extracted.value)}"`,
        fieldPaths: [entry.fieldPath],
        clauseIds: extracted.clauseId ? [extracted.clauseId] : [],
        reviewStatus: 'open',
      });
    } else {
      const verified = verifyQuote(clauses, extracted.clauseId, extracted.quote);
      setNestedField(rawRecord, entry.fieldPath, {
        value: parsed.data,
        source: {
          type: 'document',
          clauseId: extracted.clauseId,
          quote: extracted.quote,
          verified,
        },
        confidence: extracted.confidence,
        review: { status: 'pending' },
      });
    }
  }

  // Parse against LeaseRecord schema to ensure drift fails loudly
  const record = LeaseRecordSchema.parse(rawRecord);

  return { record, flags };
}
