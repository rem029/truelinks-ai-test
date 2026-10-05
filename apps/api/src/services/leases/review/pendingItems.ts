import type { Lease, RuleResult } from '@truelinks/shared';
import { listFields } from '../leaseFields.ts';

// Deterministic checklist of items blocking lease confirmation
export function listPendingItems(lease: Lease): string[] {
  const items: string[] = [];

  if (lease.analysisStatus === 'pending') {
    items.push('Analysis still pending');
  }

  if (lease.unitId === null) {
    items.push('Unit not confirmed');
  }

  for (const flag of lease.flags) {
    if (flag.reviewStatus === 'open') {
      items.push(`Open flag: ${flag.message}`);
    }
  }

  const unreviewedCount = listFields(lease.record).filter(
    ({ field }) => field.value !== null && field.review.status === 'pending'
  ).length;

  if (unreviewedCount > 0) {
    const text =
      unreviewedCount === 1
        ? '1 field not reviewed — use Accept all'
        : `${unreviewedCount} fields not reviewed — use Accept all`;
    items.push(text);
  }

  return items;
}

export function highSeverityFailures(lease: Lease): RuleResult[] {
  return lease.ruleResults.filter(
    (r) => r.status === 'FAIL' && r.severity === 'high'
  );
}
