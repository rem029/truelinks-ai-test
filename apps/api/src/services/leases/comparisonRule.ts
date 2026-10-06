import {
  describeComparison,
  formatRuleValue,
  getFieldLabel,
  type LeaseRecord,
  type RuleComparison,
  type RuleNumberField,
  type RuleOperator,
  type RuleStatus,
} from '@truelinks/shared';
import { getClauseIds, getField } from './leaseFields.ts';
import { monthlyRent } from './rent.ts';

interface ComparisonResult {
  status: RuleStatus;
  reason: string;
  clauseIds: string[];
}

function numberValue(record: LeaseRecord, field: RuleNumberField): { value: number | null; clauseIds: string[] } {
  if (field === 'rent.monthly') {
    // Derived from the stated amount and frequency when the lease doesn't state a monthly figure
    const monthly = monthlyRent(record.rent);
    return { value: monthly?.value ?? null, clauseIds: getClauseIds(record.rent.monthly, record.rent.amount, record.rent.frequency) };
  }
  const sourced = getField(record, field);
  return { value: typeof sourced.value === 'number' ? sourced.value : null, clauseIds: getClauseIds(sourced) };
}

function compare(left: number | boolean, operator: RuleOperator, right: number | boolean): boolean {
  switch (operator) {
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '=':
      return left === right;
    case '!=':
      return left !== right;
  }
}

export function checkComparison(comparison: RuleComparison, record: LeaseRecord): ComparisonResult {
  const rule = describeComparison(comparison);

  if (comparison.type === 'boolean') {
    const sourced = getField(record, comparison.field);
    const clauseIds = getClauseIds(sourced);
    if (typeof sourced.value !== 'boolean') {
      return { status: 'NOT_DETERMINABLE', reason: `${getFieldLabel(comparison.field)} not found in the lease`, clauseIds };
    }
    const pass = compare(sourced.value, comparison.operator, comparison.value);
    return { status: pass ? 'PASS' : 'FAIL', reason: `${getFieldLabel(comparison.field)} is ${formatRuleValue(sourced.value)} (rule: ${rule})`, clauseIds };
  }

  const left = numberValue(record, comparison.field);
  if (left.value === null) {
    return { status: 'NOT_DETERMINABLE', reason: `${getFieldLabel(comparison.field)} not found in the lease`, clauseIds: left.clauseIds };
  }

  if (comparison.type === 'number') {
    const pass = compare(left.value, comparison.operator, comparison.value);
    return {
      status: pass ? 'PASS' : 'FAIL',
      reason: `${getFieldLabel(comparison.field)} is ${formatRuleValue(left.value)} (rule: ${rule})`,
      clauseIds: left.clauseIds,
    };
  }

  const right = numberValue(record, comparison.otherField);
  const clauseIds = [...new Set([...left.clauseIds, ...right.clauseIds])];
  if (right.value === null) {
    return { status: 'NOT_DETERMINABLE', reason: `${getFieldLabel(comparison.otherField)} not found in the lease`, clauseIds };
  }
  const target = right.value * comparison.factor;
  const pass = compare(left.value, comparison.operator, target);
  return {
    status: pass ? 'PASS' : 'FAIL',
    reason: `${getFieldLabel(comparison.field)} is ${formatRuleValue(left.value)}, ${getFieldLabel(comparison.otherField)} is ${formatRuleValue(right.value)} (rule: ${rule})`,
    clauseIds,
  };
}
