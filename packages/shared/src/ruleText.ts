import { getFieldLabel } from './fieldLabels.ts';
import type { RuleComparison, RuleOperator } from './rules.ts';

const OPERATOR_TEXT: Record<RuleOperator, string> = {
  '<': '<',
  '<=': '≤',
  '>': '>',
  '>=': '≥',
  '=': '=',
  '!=': '≠',
};

export function formatRuleValue(value: number | boolean): string {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// "Monthly Rent ≤ 15,000", "Security Deposit ≥ 2 × Monthly Rent", "Tenant Signed = yes"
export function describeComparison(comparison: RuleComparison): string {
  const left = getFieldLabel(comparison.field);
  const op = OPERATOR_TEXT[comparison.operator];
  if (comparison.type === 'field') {
    const factor = comparison.factor === 1 ? '' : `${formatRuleValue(comparison.factor)} × `;
    return `${left} ${op} ${factor}${getFieldLabel(comparison.otherField)}`;
  }
  return `${left} ${op} ${formatRuleValue(comparison.value)}`;
}


// "1.0" → "1.1", "1.9" → "1.10": every added rule saves the next ruleset version
export function nextRulesetVersion(version: string): string {
  const match = /^(\d+)\.(\d+)$/.exec(version);
  return match ? `${match[1]}.${Number(match[2]) + 1}` : `${version}.1`;
}
