import type { Flag, LeaseRecord } from '@truelinks/shared';
import { getField, isFieldPath } from '../leaseFields.ts';
import { isLocked } from './patchRecord.ts';

// Flags originating outside detectFlags (extraction, full analysis) that must survive deterministic re-evaluation
export const KEPT_CODES = new Set<string>([
  'UNREADABLE_VALUE',
  'VALUE_CONFLICT',
  'MODEL_CONCERN',
  'ANALYSIS_FAILED',
]);

export function mergeFlags(previous: Flag[], fresh: Flag[], record: LeaseRecord): Flag[] {
  const previousMap = new Map<string, Flag>();
  for (const p of previous) {
    previousMap.set(p.id, p);
  }

  const result: Flag[] = [];
  const seenIds = new Set<string>();

  // Fresh flags come first, carrying over reviewStatus if previously seen
  for (const f of fresh) {
    const prev = previousMap.get(f.id);
    const flagToAdd: Flag = prev ? { ...f, reviewStatus: prev.reviewStatus } : f;
    result.push(flagToAdd);
    seenIds.add(f.id);
  }

  // Previous flags with kept codes survive unless their referenced fields are fully locked
  for (const p of previous) {
    if (seenIds.has(p.id)) {
      continue;
    }
    if (!KEPT_CODES.has(p.code)) {
      continue;
    }

    // A kept flag with non-empty fieldPaths is resolved (dropped) once every one of its fieldPaths is locked
    if (p.fieldPaths.length > 0) {
      const allLocked = p.fieldPaths.every((path) => {
        if (!isFieldPath(path)) {
          return false;
        }
        return isLocked(getField(record, path));
      });
      if (allLocked) {
        continue;
      }
    }

    result.push(p);
    seenIds.add(p.id);
  }

  return result;
}
