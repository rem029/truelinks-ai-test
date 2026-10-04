import type { LeaseRecord, Source } from '@truelinks/shared';
import {
  type LeaseExtraction,
  LeaseExtraction as LeaseExtractionSchema,
} from './extractionSchema.ts';

function toExtracted<T>(
  field: { value: T | null; source: Source | null; confidence: number },
  emptyValue: T
) {
  if (field.value === null) {
    return { found: false, value: emptyValue, clauseId: '', quote: '', confidence: 0 };
  }
  return {
    found: true,
    value: field.value,
    clauseId: field.source?.type === 'document' ? field.source.clauseId : '',
    quote: field.source?.type === 'document' ? field.source.quote : '',
    confidence: field.confidence,
  };
}

export function toExtraction(record: LeaseRecord): LeaseExtraction {
  const extraction: LeaseExtraction = {
    fields: {
      landlord: {
        name: toExtracted(record.landlord.name, ''),
        signed: toExtracted(record.landlord.signed, false),
      },
      tenant: {
        name: toExtracted(record.tenant.name, ''),
        signed: toExtracted(record.tenant.signed, false),
      },
      unit: {
        unitId: toExtracted(record.unit.unitId, ''),
        label: toExtracted(record.unit.label, ''),
        parkingBay: toExtracted(record.unit.parkingBay, ''),
      },
      commencementDate: toExtracted(record.commencementDate, ''),
      expiryDate: toExtracted(record.expiryDate, ''),
      termMonths: toExtracted(record.termMonths, 0),
      rent: {
        amount: toExtracted(record.rent.amount, 0),
        frequency: toExtracted<string>(record.rent.frequency, ''),
        monthly: toExtracted(record.rent.monthly, 0),
        annual: toExtracted(record.rent.annual, 0),
      },
      currency: toExtracted(record.currency, ''),
      deposit: toExtracted(record.deposit, 0),
      escalation: {
        text: toExtracted(record.escalation.text, ''),
        isDefined: toExtracted(record.escalation.isDefined, false),
      },
      renewal: toExtracted(record.renewal, ''),
      termination: toExtracted(record.termination, ''),
    },
  };

  return LeaseExtractionSchema.parse(extraction);
}
