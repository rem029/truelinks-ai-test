import {
  describeComparison,
  nextRulesetVersion,
  type NewRule,
  type Rule,
  type RuleEdit,
  type Ruleset,
} from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { HttpError } from '../../utils/httpError.ts';

type RulesetRepos = Pick<Repositories, 'rulesets'>;

// Ids continue past every id ever used, so a deleted R8 never comes back as a different rule in old lease results
export function nextRuleId(everyRule: Rule[]): string {
  const numbers = everyRule.map((r) => /^R(\d+)$/.exec(r.id)?.[1]).filter((n) => n !== undefined).map(Number);
  return `R${Math.max(0, ...numbers) + 1}`;
}

async function loadCurrent(repositories: RulesetRepos): Promise<Ruleset> {
  const current = await repositories.rulesets.getLatest();
  if (!current) {
    throw new HttpError(500, 'No ruleset found; run the seed first');
  }
  return current;
}

function findRule(ruleset: Ruleset, ruleId: string): Rule {
  const rule = ruleset.rules.find((r) => r.id === ruleId);
  if (!rule) {
    throw new HttpError(404, `Rule ${ruleId} is not in version ${ruleset.version}`);
  }
  return rule;
}

// Rules are never changed in place: every change saves the next version, so each lease keeps the version it was checked against
async function saveVersion(current: Ruleset, rules: Rule[], changeNote: string, repositories: RulesetRepos): Promise<Ruleset> {
  const saved = await repositories.rulesets.create(
    { name: current.name, version: nextRulesetVersion(current.version), rules },
    changeNote
  );
  console.log(`ruleset change version=${current.version}->${saved.version} note="${changeNote}"`);
  return saved;
}

export async function addRule(input: NewRule, repositories: RulesetRepos): Promise<Ruleset> {
  const current = await loadCurrent(repositories);
  const everyRule = (await repositories.rulesets.listVersions()).flatMap((v) => v.rules);
  const id = nextRuleId(everyRule);
  const rule: Rule =
    input.kind === 'comparison'
      ? { id, description: input.description, severity: input.severity, kind: 'comparison', comparison: input.comparison, check: describeComparison(input.comparison) }
      : { id, description: input.description, severity: input.severity, kind: 'ai', check: 'Judged by the AI in the full review, with a quote code verifies' };
  return saveVersion(current, [...current.rules, rule], `Added ${id}`, repositories);
}

// Built-in rules (R1–R7) are hand-written checks, so only their severity can change; their text describes what the code does
export function applyRuleEdit(rule: Rule, edit: RuleEdit): Rule {
  if (rule.kind === 'builtin' && (edit.description !== undefined || edit.comparison !== undefined)) {
    throw new HttpError(400, `${rule.id} is a built-in check; only its severity can change`);
  }
  if (rule.kind === 'ai' && edit.comparison !== undefined) {
    throw new HttpError(400, `${rule.id} is a plain-language rule; it has no comparison`);
  }

  const comparison = edit.comparison ?? rule.comparison;
  const updated: Rule = {
    ...rule,
    description: edit.description ?? rule.description,
    severity: edit.severity ?? rule.severity,
    comparison,
    check: rule.kind === 'comparison' && comparison ? describeComparison(comparison) : rule.check,
  };
  if (JSON.stringify(updated) === JSON.stringify(rule)) {
    throw new HttpError(400, `Nothing changed on ${rule.id}`);
  }
  return updated;
}

export async function editRule(ruleId: string, edit: RuleEdit, repositories: RulesetRepos): Promise<Ruleset> {
  const current = await loadCurrent(repositories);
  const updated = applyRuleEdit(findRule(current, ruleId), edit);
  const rules = current.rules.map((r) => (r.id === ruleId ? updated : r));
  return saveVersion(current, rules, `Edited ${ruleId}`, repositories);
}

export async function deleteRule(ruleId: string, repositories: RulesetRepos): Promise<Ruleset> {
  const current = await loadCurrent(repositories);
  findRule(current, ruleId);
  return saveVersion(current, current.rules.filter((r) => r.id !== ruleId), `Deleted ${ruleId}`, repositories);
}

// Restoring copies an old version forward as the newest one; history is never rewritten
export async function restoreVersion(version: string, repositories: RulesetRepos): Promise<Ruleset> {
  const current = await loadCurrent(repositories);
  if (version === current.version) {
    throw new HttpError(400, `Version ${version} is already the current one`);
  }
  const old = await repositories.rulesets.get(version);
  if (!old) {
    throw new HttpError(404, `Version ${version} not found`);
  }
  return saveVersion(current, old.rules, `Restored version ${version}`, repositories);
}
