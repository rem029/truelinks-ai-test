import type { LeaseRecord, Ruleset, RuleResult, RuleStatus, SourcedField } from '@truelinks/shared';
import { monthsBetween } from './leaseTerm.ts';
import { monthlyRent, compareAnnualRent } from './rent.ts';
import { formatMoney, getClauseIds } from './leaseFields.ts';
import { type UnitMatch, unitNotFoundReason } from './unitMatch.ts';
import { checkComparison } from './comparisonRule.ts';

interface CheckContext {
  record: LeaseRecord;
  unitMatch: UnitMatch;
}

interface CheckResult {
  status: RuleStatus;
  reason: string;
  clauseIds: string[];
}

type RuleCheck = (ctx: CheckContext) => CheckResult;

const checkR1: RuleCheck = ({ record }) => {
  const currency = record.currency.value;
  const deposit = record.deposit.value;
  const monthly = monthlyRent(record.rent);

  if (deposit === null || monthly === null) {
    const missing: string[] = [];
    if (deposit === null) missing.push('deposit');
    if (monthly === null) missing.push('monthly rent');
    return {
      status: 'NOT_DETERMINABLE',
      reason: `Cannot evaluate deposit: ${missing.join(' and ')} not stated`,
      clauseIds: getClauseIds(record.deposit, record.rent.monthly, record.rent.amount),
    };
  }

  const clauseIds = getClauseIds(
    record.deposit,
    monthly.derived ? record.rent.amount : record.rent.monthly,
    monthly.derived ? record.rent.frequency : null
  );

  if (deposit >= monthly.value) {
    return {
      status: 'PASS',
      reason: `Deposit ${formatMoney(deposit, currency)} is at least monthly rent ${formatMoney(monthly.value, currency)}`,
      clauseIds,
    };
  }

  return {
    status: 'FAIL',
    reason: `Deposit ${formatMoney(deposit, currency)} is less than monthly rent ${formatMoney(monthly.value, currency)}`,
    clauseIds,
  };
};

const checkR2: RuleCheck = ({ record }) => {
  const isDefined = record.escalation.isDefined.value;
  const clauseIds = getClauseIds(record.escalation.isDefined, record.escalation.text);

  if (isDefined === true) {
    return {
      status: 'PASS',
      reason: 'Rent escalation clause is defined',
      clauseIds,
    };
  }

  if (isDefined === false) {
    return {
      status: 'FAIL',
      reason: 'Rent escalation clause is not defined',
      clauseIds,
    };
  }

  return {
    status: 'NOT_DETERMINABLE',
    reason: 'Rent escalation clause is not determinable',
    clauseIds,
  };
};

const checkR3: RuleCheck = ({ record }) => {
  let term = record.termMonths.value;
  const fieldsUsed: (SourcedField | null | undefined)[] = [record.termMonths];

  if (term === null) {
    const cDate = record.commencementDate.value;
    const eDate = record.expiryDate.value;
    if (cDate && eDate) {
      term = monthsBetween(cDate, eDate);
      fieldsUsed.push(record.commencementDate, record.expiryDate);
    }
  }

  if (term === null) {
    return {
      status: 'NOT_DETERMINABLE',
      reason: 'Term length not determinable',
      clauseIds: getClauseIds(...fieldsUsed),
    };
  }

  const clauseIds = getClauseIds(...fieldsUsed);
  if (term <= 36) {
    return {
      status: 'PASS',
      reason: `Term of ${term} months does not exceed 36 months`,
      clauseIds,
    };
  }

  return {
    status: 'FAIL',
    reason: `Term of ${term} months exceeds 36 months without owner approval`,
    clauseIds,
  };
};

const checkR4: RuleCheck = ({ record }) => {
  const cDate = record.commencementDate.value;
  const eDate = record.expiryDate.value;
  const statedTerm = record.termMonths.value;

  if (!cDate || !eDate) {
    return {
      status: 'NOT_DETERMINABLE',
      reason: 'Commencement and/or expiry date missing',
      clauseIds: getClauseIds(record.commencementDate, record.expiryDate),
    };
  }

  const clauseIds = getClauseIds(record.commencementDate, record.expiryDate, record.termMonths);

  if (eDate <= cDate) {
    return {
      status: 'FAIL',
      reason: `Expiry date (${eDate}) must be after commencement date (${cDate})`,
      clauseIds,
    };
  }

  const span = monthsBetween(cDate, eDate);
  if (span === null) {
    return {
      status: 'FAIL',
      reason: `Dates (${cDate} to ${eDate}) do not form a whole number of months`,
      clauseIds,
    };
  }

  if (statedTerm !== null && statedTerm !== span) {
    return {
      status: 'FAIL',
      reason: `Stated term (${statedTerm} months) contradicts dates (${span} months)`,
      clauseIds,
    };
  }

  if (statedTerm === null) {
    return {
      status: 'PASS',
      reason: `Term of ${span} months derived from dates (${cDate} to ${eDate})`,
      clauseIds,
    };
  }

  return {
    status: 'PASS',
    reason: `Term of ${statedTerm} months matches dates (${cDate} to ${eDate})`,
    clauseIds,
  };
};

const checkR5: RuleCheck = ({ record }) => {
  const lName = record.landlord.name.value?.trim();
  const tName = record.tenant.name.value?.trim();
  const lSigned = record.landlord.signed.value;
  const tSigned = record.tenant.signed.value;

  const clauseIds = getClauseIds(
    record.landlord.name,
    record.tenant.name,
    record.landlord.signed,
    record.tenant.signed
  );

  const missingOrUnsigned: string[] = [];
  if (!lName) missingOrUnsigned.push('landlord name');
  if (!tName) missingOrUnsigned.push('tenant name');
  if (lSigned === false) missingOrUnsigned.push('landlord signature');
  if (tSigned === false) missingOrUnsigned.push('tenant signature');

  if (missingOrUnsigned.length > 0) {
    return {
      status: 'FAIL',
      reason: `Missing: ${missingOrUnsigned.join(', ')}`,
      clauseIds,
    };
  }

  if (lSigned === null || tSigned === null) {
    const nd: string[] = [];
    if (lSigned === null) nd.push('landlord signature');
    if (tSigned === null) nd.push('tenant signature');
    return {
      status: 'NOT_DETERMINABLE',
      reason: `Signature status not determinable for: ${nd.join(', ')}`,
      clauseIds,
    };
  }

  return {
    status: 'PASS',
    reason: `Both parties identified (${lName}, ${tName}) and lease is signed by both`,
    clauseIds,
  };
};

const checkR6: RuleCheck = ({ record }) => {
  const currency = record.currency.value;
  const comparison = compareAnnualRent(record.rent);

  if (comparison.status === 'not_determinable') {
    return {
      status: 'NOT_DETERMINABLE',
      reason: 'Stated annual rent or monthly rent not determinable',
      clauseIds: getClauseIds(record.rent.annual, record.rent.monthly, record.rent.amount),
    };
  }

  const monthlyInfo = monthlyRent(record.rent);
  const clauseIds = getClauseIds(
    record.rent.annual,
    monthlyInfo?.derived ? record.rent.amount : record.rent.monthly,
    monthlyInfo?.derived ? record.rent.frequency : null
  );

  if (comparison.status === 'reconciled') {
    if (record.rent.frequency.value === 'annual' && record.rent.monthly.value === null) {
      return {
        status: 'PASS',
        reason: `Rent is stated annually (${formatMoney(comparison.stated, currency)}); no monthly figure to reconcile`,
        clauseIds,
      };
    }
    return {
      status: 'PASS',
      reason: `Annual rent ${formatMoney(comparison.stated, currency)} reconciles with monthly rent ${formatMoney(comparison.monthly, currency)} x 12`,
      clauseIds,
    };
  }

  return {
    status: 'FAIL',
    reason: `Annual rent ${formatMoney(comparison.stated, currency)} does not reconcile with monthly rent ${formatMoney(comparison.monthly, currency)} x 12 (${formatMoney(comparison.expected, currency)})`,
    clauseIds,
  };
};

const checkR7: RuleCheck = ({ record, unitMatch }) => {
  const clauseIds = getClauseIds(record.unit.unitId, record.unit.label, record.unit.parkingBay);

  if (unitMatch.status === 'matched') {
    if (unitMatch.unit.status === 'available') {
      return {
        status: 'PASS',
        reason: `Unit ${unitMatch.unit.unitId} is available`,
        clauseIds,
      };
    }
    return {
      status: 'FAIL',
      reason: `Unit ${unitMatch.unit.unitId} is occupied`,
      clauseIds,
    };
  }

  if (unitMatch.suggestions.length > 0) {
    const suggested = unitMatch.suggestions.map((u) => u.unitId).join(', ');
    return {
      status: 'NOT_DETERMINABLE',
      reason: `Unit not confirmed; owner to choose (suggested ${suggested})`,
      clauseIds,
    };
  }

  return {
    status: 'FAIL',
    reason: unitNotFoundReason(record, unitMatch.statedUnitId),
    clauseIds,
  };
};

const ruleChecks: Record<string, RuleCheck> = {
  R1: checkR1,
  R2: checkR2,
  R3: checkR3,
  R4: checkR4,
  R5: checkR5,
  R6: checkR6,
  R7: checkR7,
};

export function evaluateRules(input: {
  record: LeaseRecord;
  unitMatch: UnitMatch;
  ruleset: Ruleset;
  // Results already on the lease: plain-language rules are judged by the background analysis, not here
  previousResults?: RuleResult[];
}): RuleResult[] {
  return input.ruleset.rules.map((rule): RuleResult => {
    const base = { ruleId: rule.id, severity: rule.severity, rulesetVersion: input.ruleset.version };

    if (rule.kind === 'ai') {
      const previous = input.previousResults?.find((r) => r.ruleId === rule.id && r.checkedBy === 'ai');
      return previous
        ? { ...previous, ...base }
        : { ...base, status: 'NOT_DETERMINABLE', reason: 'Not checked by the AI yet (it runs in the full review after upload)', clauseIds: [], checkedBy: 'ai' };
    }

    if (rule.kind === 'comparison') {
      if (!rule.comparison) {
        return { ...base, status: 'NOT_DETERMINABLE', reason: 'Rule has no comparison', clauseIds: [], checkedBy: 'code' };
      }
      return { ...base, ...checkComparison(rule.comparison, input.record), checkedBy: 'code' };
    }

    const check = ruleChecks[rule.id];
    if (!check) {
      return { ...base, status: 'NOT_DETERMINABLE', reason: `No check implemented for rule ${rule.id}`, clauseIds: [], checkedBy: 'code' };
    }
    return { ...base, ...check({ record: input.record, unitMatch: input.unitMatch }), checkedBy: 'code' };
  });
}
