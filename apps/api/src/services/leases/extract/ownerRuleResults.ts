import type { Clause, Rule, RuleResult } from '@truelinks/shared';
import type { OwnerRuleJudgement } from './extractionSchema.ts';
import { verifyQuote } from './verifyQuote.ts';

// The model judges plain-language rules; code only keeps a PASS or a quoted FAIL whose quote is really in the clause
export function buildOwnerRuleResults(
  judgements: OwnerRuleJudgement[],
  aiRules: Rule[],
  clauses: Clause[],
  rulesetVersion: string
): RuleResult[] {
  return aiRules.map((rule) => {
    const base = { ruleId: rule.id, severity: rule.severity, rulesetVersion, checkedBy: 'ai' as const };
    const judgement = judgements.find((j) => j.ruleId === rule.id);
    if (!judgement) {
      return { ...base, status: 'NOT_DETERMINABLE', reason: 'The AI gave no verdict for this rule', clauseIds: [] };
    }

    const hasQuote = judgement.clauseId !== null && judgement.quote !== null && judgement.quote.trim() !== '';
    const quoteVerified = hasQuote && verifyQuote(clauses, judgement.clauseId!, judgement.quote!);
    const clauseIds = quoteVerified ? [judgement.clauseId!] : [];

    if (judgement.status === 'PASS' && !quoteVerified) {
      return { ...base, status: 'NOT_DETERMINABLE', reason: `${judgement.reason} (AI said pass, but its quote wasn't found in the lease)`, clauseIds };
    }
    if (judgement.status === 'FAIL' && hasQuote && !quoteVerified) {
      return { ...base, status: 'NOT_DETERMINABLE', reason: `${judgement.reason} (AI said fail, but its quote wasn't found in the lease)`, clauseIds };
    }
    return { ...base, status: judgement.status, reason: judgement.reason, clauseIds };
  });
}
