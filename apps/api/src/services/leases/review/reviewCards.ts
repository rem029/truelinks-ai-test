import type { Card, Lease } from '@truelinks/shared';
import { FIELD_PATHS, type FieldPath, getField, isFieldPath, listFields } from '../leaseFields.ts';
import { type UnitMatch, unitNotFoundReason } from '../unitMatch.ts';

export type ParsedCardId =
  | { kind: 'field'; fieldPath: FieldPath }
  | { kind: 'flag'; flagId: string }
  | { kind: 'rule'; ruleId: string }
  | { kind: 'unitMatch' }
  | { kind: 'summary' }
  | null;

export function parseCardId(cardId: string): ParsedCardId {
  if (cardId === 'summary') {
    return { kind: 'summary' };
  }
  if (cardId === 'unitMatch') {
    return { kind: 'unitMatch' };
  }
  if (cardId.startsWith('field:')) {
    const fieldPath = cardId.slice('field:'.length);
    if (isFieldPath(fieldPath)) {
      return { kind: 'field', fieldPath };
    }
    return null;
  }
  if (cardId.startsWith('flag:')) {
    const flagId = cardId.slice('flag:'.length);
    return flagId.length > 0 ? { kind: 'flag', flagId } : null;
  }
  if (cardId.startsWith('rule:')) {
    const ruleId = cardId.slice('rule:'.length);
    return ruleId.length > 0 ? { kind: 'rule', ruleId } : null;
  }
  return null;
}

// Builds cards for the human review UI: summary first, then only items needing attention
export function buildReviewCards(lease: Lease, unitMatch: UnitMatch): Card[] {
  const cards: Card[] = [];

  const fields = listFields(lease.record);
  const foundCount = fields.filter(({ field }) => field.value !== null).length;
  const passCount = lease.ruleResults.filter((r) => r.status === 'PASS').length;
  const failCount = lease.ruleResults.filter((r) => r.status === 'FAIL').length;
  const notDetCount = lease.ruleResults.filter((r) => r.status === 'NOT_DETERMINABLE').length;

  const openFlags = lease.flags.filter((f) => f.reviewStatus === 'open');
  const flaggedPaths = new Set<string>();
  for (const flag of openFlags) {
    for (const p of flag.fieldPaths) {
      flaggedPaths.add(p);
    }
  }

  const fineCount = fields.filter(
    ({ fieldPath, field }) => field.value !== null && field.review.status === 'pending' && !flaggedPaths.has(fieldPath)
  ).length;

  const summaryLines: string[] = [
    `${foundCount}/${fields.length} fields found`,
    `Rules: ${passCount} pass / ${failCount} fail / ${notDetCount} not determinable`,
    `${openFlags.length} open ${openFlags.length === 1 ? 'flag' : 'flags'}`,
  ];

  if (lease.analysisStatus === 'pending') {
    summaryLines.push('Full review still running');
  }

  if (fineCount > 0) {
    summaryLines.push(`${fineCount} fields look fine — Accept all`);
  }

  cards.push({
    id: 'summary',
    type: 'summary',
    title: 'Lease review',
    lines: summaryLines,
  });

  // Items needing attention:
  // 1. Unit match card if unconfirmed
  if (unitMatch.status === 'unconfirmed') {
    cards.push({
      id: 'unitMatch',
      type: 'unitMatch',
      candidates: unitMatch.suggestions,
      chosenUnitId: null,
      reason: unitNotFoundReason(lease.record, unitMatch.statedUnitId),
    });
  }

  // 2. Open flag cards
  for (const flag of openFlags) {
    cards.push({
      id: `flag:${flag.id}`,
      type: 'flag',
      flag,
    });
  }

  // 3. Rule cards for FAIL or NOT_DETERMINABLE
  for (const result of lease.ruleResults) {
    if (result.status === 'FAIL' || result.status === 'NOT_DETERMINABLE') {
      cards.push({
        id: `rule:${result.ruleId}`,
        type: 'rule',
        result,
      });
    }
  }

  // 4. Field cards for pending-review fields referenced by open flags
  const pendingFlaggedPaths = new Set<FieldPath>();
  for (const flag of openFlags) {
    for (const path of flag.fieldPaths) {
      if (isFieldPath(path)) {
        const field = getField(lease.record, path);
        if (field.review.status === 'pending') {
          pendingFlaggedPaths.add(path);
        }
      }
    }
  }

  for (const path of FIELD_PATHS) {
    if (pendingFlaggedPaths.has(path)) {
      cards.push({
        id: `field:${path}`,
        type: 'field',
        fieldPath: path,
        field: getField(lease.record, path),
      });
    }
  }

  return cards;
}

function formatFieldValue(v: unknown): string {
  if (v === null || v === undefined) {
    return 'none';
  }
  if (typeof v === 'number') {
    return v.toLocaleString('en-US');
  }
  return String(v);
}

// Generates human-readable diff bullets after a review turn
export function describeChanges(before: Lease, after: Lease): string[] {
  const changes: string[] = [];

  // Field values changed
  for (const path of FIELD_PATHS) {
    const beforeVal = getField(before.record, path).value;
    const afterVal = getField(after.record, path).value;
    if (beforeVal !== afterVal) {
      changes.push(`${path}: ${formatFieldValue(beforeVal)} → ${formatFieldValue(afterVal)}`);
    }
  }

  // Unit changes
  if (before.unitId !== after.unitId) {
    if (before.unitId === null && after.unitId !== null) {
      changes.push(`Unit set to ${after.unitId}`);
    } else if (before.unitId !== null && after.unitId === null) {
      changes.push('Unit cleared');
    } else {
      changes.push(`Unit changed: ${before.unitId} → ${after.unitId}`);
    }
  }

  // Rule status changes
  const beforeRules = new Map(before.ruleResults.map((r) => [r.ruleId, r]));
  for (const afterRule of after.ruleResults) {
    const beforeRule = beforeRules.get(afterRule.ruleId);
    if (beforeRule && beforeRule.status !== afterRule.status) {
      changes.push(`${afterRule.ruleId}: ${beforeRule.status} → ${afterRule.status}`);
    }
  }

  // Flags resolved or added
  const beforeOpenFlags = new Map(
    before.flags.filter((f) => f.reviewStatus === 'open').map((f) => [f.id, f])
  );
  const afterOpenFlags = new Map(
    after.flags.filter((f) => f.reviewStatus === 'open').map((f) => [f.id, f])
  );

  for (const [id, flag] of beforeOpenFlags) {
    if (!afterOpenFlags.has(id)) {
      changes.push(`Flag resolved: ${flag.message}`);
    }
  }

  for (const [id, flag] of afterOpenFlags) {
    if (!beforeOpenFlags.has(id)) {
      changes.push(`New flag: ${flag.message}`);
    }
  }

  return changes;
}
