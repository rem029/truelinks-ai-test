import type { Flag, LeaseRecord, SourcedField } from '@truelinks/shared';
import { FIELD_VALUE_SCHEMAS, type FieldPath, getField, listFields, setField } from '../leaseFields.ts';

// Accepted and edited fields represent owner sign-off and cannot be overwritten by automatic re-extraction
export function isLocked(field: SourcedField): boolean {
  return field.review.status === 'accepted' || field.review.status === 'edited';
}

const NUMBER_PATHS = new Set<FieldPath>([
  'termMonths',
  'rent.amount',
  'rent.monthly',
  'rent.annual',
  'deposit',
]);

const BOOLEAN_PATHS = new Set<FieldPath>([
  'landlord.signed',
  'tenant.signed',
  'escalation.isDefined',
]);

const DATE_PATHS = new Set<FieldPath>([
  'commencementDate',
  'expiryDate',
]);

function expectedType(path: FieldPath): string {
  if (NUMBER_PATHS.has(path)) {
    return 'number';
  }
  if (BOOLEAN_PATHS.has(path)) {
    return 'boolean';
  }
  if (DATE_PATHS.has(path)) {
    return 'date in YYYY-MM-DD format';
  }
  if (path === 'rent.frequency') {
    return 'rent frequency (monthly, quarterly, or annual)';
  }
  return 'string';
}

export function parseFieldValue(
  path: FieldPath,
  raw: unknown
): { ok: true; value: unknown } | { ok: false; error: string } {
  let coerced = raw;

  if (NUMBER_PATHS.has(path)) {
    if (typeof raw === 'string') {
      const stripped = raw
        .trim()
        .replace(/,/g, '')
        .replace(/^[A-Za-z$€£\s]+/, '')
        .replace(/[A-Za-z$€£\s]+$/, '')
        .trim();
      if (stripped === '' || !/^-?\d+(?:\.\d+)?$/.test(stripped)) {
        return { ok: false, error: `Invalid value for ${path}: expected ${expectedType(path)}` };
      }
      coerced = Number(stripped);
    } else if (typeof raw !== 'number') {
      return { ok: false, error: `Invalid value for ${path}: expected ${expectedType(path)}` };
    }
  } else if (path === 'currency') {
    if (typeof raw === 'string') {
      coerced = raw.trim().toUpperCase();
    } else {
      return { ok: false, error: `Invalid value for ${path}: expected ${expectedType(path)}` };
    }
  } else if (path === 'rent.frequency') {
    if (typeof raw === 'string') {
      coerced = raw.trim().toLowerCase();
    } else {
      return { ok: false, error: `Invalid value for ${path}: expected ${expectedType(path)}` };
    }
  } else if (BOOLEAN_PATHS.has(path)) {
    if (typeof raw === 'string') {
      const lower = raw.trim().toLowerCase();
      if (lower === 'true') {
        coerced = true;
      } else if (lower === 'false') {
        coerced = false;
      } else {
        return { ok: false, error: `Invalid value for ${path}: expected ${expectedType(path)}` };
      }
    } else if (typeof raw !== 'boolean') {
      return { ok: false, error: `Invalid value for ${path}: expected ${expectedType(path)}` };
    }
  } else if (DATE_PATHS.has(path)) {
    if (typeof raw === 'string') {
      coerced = raw.trim();
    } else {
      return { ok: false, error: `Invalid value for ${path}: expected ${expectedType(path)}` };
    }
  }

  const schema = FIELD_VALUE_SCHEMAS[path];
  const parsed = schema.safeParse(coerced);
  if (!parsed.success) {
    return { ok: false, error: `Invalid value for ${path}: expected ${expectedType(path)}` };
  }

  return { ok: true, value: parsed.data };
}

export function acceptField(record: LeaseRecord, path: FieldPath, now: string): LeaseRecord {
  const current = getField(record, path);
  if (current.value === null) {
    throw new Error(`Cannot accept field ${path}: value is null`);
  }

  const updated: SourcedField = {
    ...current,
    review: {
      status: 'accepted',
      ...(current.review.original !== undefined ? { original: current.review.original } : {}),
      reviewedAt: now,
    },
  };

  return setField(record, path, updated);
}

export function rejectField(record: LeaseRecord, path: FieldPath, now: string): LeaseRecord {
  const current = getField(record, path);
  const original = current.review.original !== undefined ? current.review.original : (current.value !== null ? current.value : undefined);

  const updated: SourcedField = {
    value: null,
    source: null,
    confidence: 0,
    review: {
      status: 'rejected',
      ...(original !== undefined ? { original } : {}),
      reviewedAt: now,
    },
  };

  return setField(record, path, updated);
}

export function editField(
  record: LeaseRecord,
  path: FieldPath,
  rawValue: unknown,
  messageId: string,
  now: string
): LeaseRecord {
  const parsed = parseFieldValue(path, rawValue);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const current = getField(record, path);
  // Retain the very first original value if edited multiple times
  const original = current.review.original !== undefined ? current.review.original : (current.value !== null ? current.value : undefined);

  const updated: SourcedField = {
    value: parsed.value,
    source: {
      type: 'user',
      messageId,
    },
    confidence: 1,
    review: {
      status: 'edited',
      ...(original !== undefined ? { original } : {}),
      reviewedAt: now,
    },
  };

  return setField(record, path, updated);
}

export function acceptAllFields(
  record: LeaseRecord,
  openFlags: Flag[],
  now: string
): { record: LeaseRecord; acceptedPaths: FieldPath[] } {
  const flaggedPaths = new Set<string>();
  for (const flag of openFlags) {
    if (flag.reviewStatus === 'open') {
      for (const p of flag.fieldPaths) {
        flaggedPaths.add(p);
      }
    }
  }

  let currentRecord = record;
  const acceptedPaths: FieldPath[] = [];

  for (const { fieldPath, field } of listFields(currentRecord)) {
    if (field.value !== null && field.review.status === 'pending' && !flaggedPaths.has(fieldPath)) {
      currentRecord = acceptField(currentRecord, fieldPath, now);
      acceptedPaths.push(fieldPath);
    }
  }

  return { record: currentRecord, acceptedPaths };
}
