import type { Flag, LeaseDocument, LeaseRecord, Severity } from '@truelinks/shared';
import { monthsBetween } from './leaseTerm.ts';
import { monthlyRent, compareAnnualRent } from './rent.ts';
import { formatMoney, getClauseIds, listFields } from './leaseFields.ts';
import { type UnitMatch, unitNotFoundReason } from './unitMatch.ts';

export interface DetectFlagsInput {
  record: LeaseRecord;
  unitMatch: UnitMatch;
  pageUnitId?: string | null;
  document?: Pick<LeaseDocument, 'textSource' | 'clauseSplit'>;
}

function flag(params: {
  code: string;
  severity: Severity;
  message: string;
  fieldPaths: string[];
  clauseIds: string[];
  id?: string;
}): Flag {
  return {
    id: params.id ?? params.code,
    code: params.code,
    severity: params.severity,
    message: params.message,
    fieldPaths: params.fieldPaths,
    clauseIds: params.clauseIds,
    reviewStatus: 'open',
  };
}

function missingFieldFlags(record: LeaseRecord): Flag[] {
  const flags: Flag[] = [];
  const required: Array<{
    fieldPath: string;
    value: unknown;
    message: string;
    severity: Severity;
  }> = [
    { fieldPath: 'landlord.name', value: record.landlord.name.value, message: 'Landlord name not stated', severity: 'high' },
    { fieldPath: 'tenant.name', value: record.tenant.name.value, message: 'Tenant name not stated', severity: 'high' },
    { fieldPath: 'commencementDate', value: record.commencementDate.value, message: 'Commencement date not stated', severity: 'high' },
    { fieldPath: 'expiryDate', value: record.expiryDate.value, message: 'Expiry date not stated', severity: 'high' },
    { fieldPath: 'termMonths', value: record.termMonths.value, message: 'Lease term not stated', severity: 'medium' },
    { fieldPath: 'rent.amount', value: record.rent.amount.value, message: 'Rent amount not stated', severity: 'high' },
    { fieldPath: 'deposit', value: record.deposit.value, message: 'Security deposit not stated', severity: 'medium' },
    { fieldPath: 'escalation.text', value: record.escalation.text.value, message: 'Rent escalation terms not stated', severity: 'medium' },
  ];

  for (const item of required) {
    const isMissing =
      item.value === null ||
      (typeof item.value === 'string' && item.value.trim() === '');
    if (isMissing) {
      flags.push(
        flag({
          id: `MISSING_FIELD:${item.fieldPath}`,
          code: 'MISSING_FIELD',
          severity: item.severity,
          message: item.message,
          fieldPaths: [item.fieldPath],
          clauseIds: [],
        })
      );
    }
  }

  return flags;
}

function termFlags(record: LeaseRecord): Flag[] {
  const cDate = record.commencementDate.value;
  const eDate = record.expiryDate.value;
  const termMonths = record.termMonths.value;

  if (cDate && eDate && termMonths !== null) {
    const span = monthsBetween(cDate, eDate);
    if (span !== null && termMonths !== span) {
      return [
        flag({
          code: 'TERM_DATES_MISMATCH',
          severity: 'high',
          message: `Stated term (${termMonths} months) contradicts dates (${span} months)`,
          fieldPaths: ['termMonths', 'commencementDate', 'expiryDate'],
          clauseIds: getClauseIds(record.termMonths, record.commencementDate, record.expiryDate),
        }),
      ];
    }
  }

  return [];
}

function rentFlags(record: LeaseRecord): Flag[] {
  const flags: Flag[] = [];
  const currency = record.currency.value;
  const comparison = compareAnnualRent(record.rent);
  const monthlyInfo = monthlyRent(record.rent);

  if (comparison.status === 'mismatch') {
    flags.push(
      flag({
        code: 'ANNUAL_RENT_MISMATCH',
        severity: 'low',
        message: `Annual rent ${formatMoney(comparison.stated, currency)} != ${formatMoney(comparison.monthly, currency)} x 12 (${formatMoney(comparison.expected, currency)})`,
        fieldPaths: ['rent.annual', monthlyInfo?.derived ? 'rent.amount' : 'rent.monthly'],
        clauseIds: getClauseIds(
          record.rent.annual,
          monthlyInfo?.derived ? record.rent.amount : record.rent.monthly
        ),
      })
    );
  }

  if (
    monthlyInfo?.derived &&
    record.rent.frequency.value &&
    record.rent.frequency.value !== 'monthly'
  ) {
    flags.push(
      flag({
        code: 'RENT_DERIVED',
        severity: 'low',
        message: `Rent is ${record.rent.frequency.value} (monthly derived: ${monthlyInfo.value.toLocaleString('en-US')})`,
        fieldPaths: ['rent.amount', 'rent.frequency'],
        clauseIds: getClauseIds(record.rent.amount, record.rent.frequency),
      })
    );
  }

  return flags;
}

function signatureFlags(record: LeaseRecord): Flag[] {
  const flags: Flag[] = [];

  if (record.landlord.signed.value === false) {
    flags.push(
      flag({
        id: 'SIGNATURE_MISSING:landlord',
        code: 'SIGNATURE_MISSING',
        severity: 'high',
        message: 'Landlord signature missing',
        fieldPaths: ['landlord.signed'],
        clauseIds: getClauseIds(record.landlord.signed),
      })
    );
  }

  if (record.tenant.signed.value === false) {
    flags.push(
      flag({
        id: 'SIGNATURE_MISSING:tenant',
        code: 'SIGNATURE_MISSING',
        severity: 'high',
        message: 'Tenant signature missing',
        fieldPaths: ['tenant.signed'],
        clauseIds: getClauseIds(record.tenant.signed),
      })
    );
  }

  return flags;
}

function oddValueFlags(record: LeaseRecord): Flag[] {
  const flags: Flag[] = [];

  if (record.rent.amount.value !== null && record.rent.amount.value <= 0) {
    flags.push(
      flag({
        id: 'ODD_VALUE:rent.amount',
        code: 'ODD_VALUE',
        severity: 'medium',
        message: `Rent amount is odd: ${record.rent.amount.value.toLocaleString('en-US')}`,
        fieldPaths: ['rent.amount'],
        clauseIds: getClauseIds(record.rent.amount),
      })
    );
  }

  if (record.deposit.value !== null && record.deposit.value <= 0) {
    flags.push(
      flag({
        id: 'ODD_VALUE:deposit',
        code: 'ODD_VALUE',
        severity: 'medium',
        message: `Security deposit is odd: ${record.deposit.value.toLocaleString('en-US')}`,
        fieldPaths: ['deposit'],
        clauseIds: getClauseIds(record.deposit),
      })
    );
  }

  if (
    record.termMonths.value !== null &&
    (record.termMonths.value <= 0 || !Number.isInteger(record.termMonths.value))
  ) {
    flags.push(
      flag({
        id: 'ODD_VALUE:termMonths',
        code: 'ODD_VALUE',
        severity: 'medium',
        message: `Lease term is odd: ${record.termMonths.value} months`,
        fieldPaths: ['termMonths'],
        clauseIds: getClauseIds(record.termMonths),
      })
    );
  }

  return flags;
}

function unitFlags(
  record: LeaseRecord,
  unitMatch: UnitMatch,
  pageUnitId?: string | null
): Flag[] {
  const flags: Flag[] = [];

  if (unitMatch.status === 'unconfirmed') {
    if (unitMatch.suggestions.length > 0) {
      const suggested = unitMatch.suggestions.map((u) => u.unitId).join(', ');
      const message = unitMatch.statedUnitId
        ? `Unit ID '${unitMatch.statedUnitId}' not in owner records; owner to confirm (suggested ${suggested})`
        : `Unit ID not stated; owner to confirm (suggested ${suggested})`;

      flags.push(
        flag({
          code: 'UNIT_NOT_CONFIRMED',
          severity: 'high',
          message,
          fieldPaths: ['unit.unitId', 'unit.label', 'unit.parkingBay'],
          clauseIds: getClauseIds(record.unit.unitId, record.unit.label, record.unit.parkingBay),
        })
      );
    } else {
      flags.push(
        flag({
          code: 'UNIT_NOT_FOUND',
          severity: 'high',
          message: unitNotFoundReason(record, unitMatch.statedUnitId),
          fieldPaths: ['unit.unitId', 'unit.label'],
          clauseIds: getClauseIds(record.unit.unitId, record.unit.label),
        })
      );
    }
  }

  if (
    pageUnitId &&
    unitMatch.status === 'matched' &&
    unitMatch.unit.unitId !== pageUnitId
  ) {
    flags.push(
      flag({
        code: 'UNIT_PAGE_MISMATCH',
        severity: 'high',
        message: `Matched unit ${unitMatch.unit.unitId} does not match expected page unit ${pageUnitId}`,
        fieldPaths: ['unit.unitId'],
        clauseIds: getClauseIds(record.unit.unitId),
      })
    );
  }

  return flags;
}

function unverifiedQuoteFlags(record: LeaseRecord): Flag[] {
  const flags: Flag[] = [];
  for (const { fieldPath, field } of listFields(record)) {
    const source = field.source;
    if (source?.type === 'document' && !source.verified) {
      flags.push(
        flag({
          id: `UNVERIFIED_QUOTE:${fieldPath}`,
          code: 'UNVERIFIED_QUOTE',
          severity: 'medium',
          message: `Quote for ${fieldPath} not found in clause ${source.clauseId}`,
          fieldPaths: [fieldPath],
          clauseIds: [source.clauseId],
        })
      );
    }
  }
  return flags;
}

// Amounts are only trusted in QAR; anything else goes to the owner, never through a conversion
function currencyFlags(record: LeaseRecord): Flag[] {
  const amounts = [record.rent.amount, record.rent.monthly, record.rent.annual, record.deposit];
  if (amounts.every((f) => f.value === null)) {
    return [];
  }

  const currency = record.currency.value?.trim().toUpperCase() || null;
  if (currency === null) {
    return [
      flag({
        code: 'CURRENCY_MISSING',
        severity: 'high',
        message: 'Currency not stated; owner to confirm amounts are in QAR',
        fieldPaths: ['currency'],
        clauseIds: [],
      }),
    ];
  }

  if (currency !== 'QAR') {
    return [
      flag({
        code: 'CURRENCY_NOT_QAR',
        severity: 'high',
        message: `Amounts are in ${currency}, not QAR; owner to confirm (no conversion applied)`,
        fieldPaths: ['currency'],
        clauseIds: getClauseIds(record.currency),
      }),
    ];
  }

  return [];
}

function documentFlags(document?: Pick<LeaseDocument, 'textSource' | 'clauseSplit'>): Flag[] {
  if (!document) {
    return [];
  }

  const flags: Flag[] = [];
  if (document.textSource === 'image') {
    flags.push(
      flag({
        code: 'TEXT_FROM_IMAGE',
        severity: 'medium',
        message: 'Text transcribed from image; quotes checked against the transcription',
        fieldPaths: [],
        clauseIds: [],
      })
    );
  }
  if (document.clauseSplit === 'ai') {
    flags.push(
      flag({
        code: 'CLAUSE_SPLIT_AI',
        severity: 'low',
        message: 'Clauses were split by AI; check clause boundaries',
        fieldPaths: [],
        clauseIds: [],
      })
    );
  }
  if (document.clauseSplit === 'paragraphs') {
    flags.push(
      flag({
        code: 'CLAUSE_SPLIT_PARAGRAPHS',
        severity: 'low',
        message: 'No clause headings found; clauses are paragraphs',
        fieldPaths: [],
        clauseIds: [],
      })
    );
  }
  return flags;
}

export function detectFlags(input: DetectFlagsInput): Flag[] {
  return [
    ...missingFieldFlags(input.record),
    ...termFlags(input.record),
    ...rentFlags(input.record),
    ...signatureFlags(input.record),
    ...oddValueFlags(input.record),
    ...unitFlags(input.record, input.unitMatch, input.pageUnitId),
    ...unverifiedQuoteFlags(input.record),
    ...currencyFlags(input.record),
    ...documentFlags(input.document),
  ];
}
