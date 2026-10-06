import { useState } from 'react';
import {
  describeComparison,
  getFieldLabel,
  NewRule,
  RULE_BOOLEAN_FIELDS,
  RULE_NUMBER_FIELDS,
  type Rule,
  type RuleComparison,
  type RuleEdit,
  type RuleNumberField,
  type RuleOperator,
  type Ruleset,
  type Severity,
} from '@truelinks/shared';
import { addRule, editRule } from '../../utils/api.ts';

export interface RuleFormProps {
  // Editing when set; the rule's kind can't change, and built-in rules only change severity
  rule?: Rule;
  onSaved: (ruleset: Ruleset) => void;
  onCancel: () => void;
}

type Kind = 'comparison' | 'ai';
type Target = 'number' | 'field';

const NUMBER_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: '<=', label: '≤ at most' },
  { value: '<', label: '< less than' },
  { value: '>=', label: '≥ at least' },
  { value: '>', label: '> more than' },
  { value: '=', label: '= equal to' },
  { value: '!=', label: '≠ not equal to' },
];

function isBooleanField(field: string): field is (typeof RULE_BOOLEAN_FIELDS)[number] {
  return (RULE_BOOLEAN_FIELDS as readonly string[]).includes(field);
}

export function RuleForm({ rule, onSaved, onCancel }: RuleFormProps) {
  const initial = rule?.comparison;
  const isBuiltin = rule?.kind === 'builtin';

  const [kind, setKind] = useState<Kind>(rule?.kind === 'ai' ? 'ai' : 'comparison');
  // An auto-generated description starts empty, so it follows the comparison as it's edited
  const autoDescription = rule?.comparison !== undefined && rule.description === describeComparison(rule.comparison);
  const [description, setDescription] = useState(rule && !isBuiltin && !autoDescription ? rule.description : '');
  const [severity, setSeverity] = useState<Severity>(rule?.severity ?? 'medium');
  const [field, setField] = useState<string>(initial?.field ?? 'rent.monthly');
  const [operator, setOperator] = useState<RuleOperator>(initial?.operator ?? '<=');
  const [target, setTarget] = useState<Target>(initial?.type === 'field' ? 'field' : 'number');
  const [value, setValue] = useState(initial?.type === 'number' ? String(initial.value) : '');
  const [otherField, setOtherField] = useState<RuleNumberField>(initial?.type === 'field' ? initial.otherField : 'rent.monthly');
  const [factor, setFactor] = useState(initial?.type === 'field' ? String(initial.factor) : '1');
  const [boolValue, setBoolValue] = useState(initial?.type === 'boolean' ? initial.value : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // null while the inputs don't make a complete comparison yet
  function buildComparison(): RuleComparison | null {
    if (isBooleanField(field)) {
      return { type: 'boolean', field, operator: operator === '!=' ? '!=' : '=', value: boolValue };
    }
    const numberField = field as RuleNumberField;
    if (target === 'field') {
      const f = Number(factor);
      return f > 0 ? { type: 'field', field: numberField, operator, otherField, factor: f } : null;
    }
    return value.trim() !== '' && Number.isFinite(Number(value))
      ? { type: 'number', field: numberField, operator, value: Number(value) }
      : null;
  }

  const comparison = !isBuiltin && kind === 'comparison' ? buildComparison() : null;
  const preview = comparison ? describeComparison(comparison) : null;

  async function save(): Promise<Ruleset> {
    if (rule) {
      if (kind === 'comparison' && !isBuiltin && !comparison) throw new Error('Fill in the comparison: field, operator and value.');
      const edit: RuleEdit = isBuiltin
        ? { severity }
        : kind === 'comparison'
          ? { severity, comparison: comparison ?? undefined, description: description.trim() || preview || undefined }
          : { severity, description: description.trim() };
      return editRule(rule.id, edit);
    }
    const parsed = NewRule.safeParse(
      kind === 'comparison'
        ? { kind, severity, comparison, description: description.trim() || preview || '' }
        : { kind, severity, description: description.trim() }
    );
    if (!parsed.success) {
      throw new Error(kind === 'comparison' && !comparison ? 'Fill in the comparison: field, operator and value.' : parsed.error.issues[0]?.message ?? 'Invalid rule');
    }
    return addRule(parsed.data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      onSaved(await save());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit} aria-label={rule ? `Edit ${rule.id}` : 'Add rule'}>
      {rule ? (
        <p className="settings-fixed">
          <span className="settings-label">Rule</span>
          {isBuiltin ? rule.description : rule.kind === 'ai' ? 'Plain language, judged by the AI' : 'Compares a lease field, checked by code'}
          {isBuiltin && <span className="settings-hint">A built-in check written in code; only its severity can change.</span>}
        </p>
      ) : (
        <fieldset className="settings-fieldset">
          <legend className="settings-label">How is it checked?</legend>
          <div className="choice-cards">
            <label className={`choice-card ${kind === 'comparison' ? 'is-selected' : ''}`}>
              <input type="radio" name="rule-kind" checked={kind === 'comparison'} onChange={() => setKind('comparison')} />
              <span className="choice-card-title">Compare a lease field</span>
              <span className="choice-card-text">A number or yes/no check. Code decides, exactly.</span>
            </label>
            <label className={`choice-card ${kind === 'ai' ? 'is-selected' : ''}`}>
              <input type="radio" name="rule-kind" checked={kind === 'ai'} onChange={() => setKind('ai')} />
              <span className="choice-card-title">Plain language</span>
              <span className="choice-card-text">The AI reads the lease and must quote the clause it relied on.</span>
            </label>
          </div>
        </fieldset>
      )}

      {!isBuiltin && kind === 'comparison' && (
        <div className="settings-form-row">
          <label className="settings-field">
            <span className="settings-label">Field</span>
            <select value={field} onChange={(e) => setField(e.target.value)}>
              {[...RULE_NUMBER_FIELDS, ...RULE_BOOLEAN_FIELDS].map((f) => (
                <option key={f} value={f}>
                  {getFieldLabel(f)}
                </option>
              ))}
            </select>
          </label>

          {isBooleanField(field) ? (
            <label className="settings-field">
              <span className="settings-label">Must be</span>
              <select value={boolValue ? 'yes' : 'no'} onChange={(e) => setBoolValue(e.target.value === 'yes')}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          ) : (
            <>
              <label className="settings-field">
                <span className="settings-label">Must be</span>
                <select value={operator} onChange={(e) => setOperator(e.target.value as RuleOperator)}>
                  {NUMBER_OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span className="settings-label">Compared with</span>
                <select value={target} onChange={(e) => setTarget(e.target.value as Target)}>
                  <option value="number">A number</option>
                  <option value="field">Another field</option>
                </select>
              </label>
              {target === 'number' ? (
                <label className="settings-field">
                  <span className="settings-label">Value</span>
                  <input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
                </label>
              ) : (
                <>
                  <label className="settings-field settings-field-narrow">
                    <span className="settings-label">Times</span>
                    <input type="number" min="0" step="0.1" value={factor} onChange={(e) => setFactor(e.target.value)} />
                  </label>
                  <label className="settings-field">
                    <span className="settings-label">Other field</span>
                    <select value={otherField} onChange={(e) => setOtherField(e.target.value as RuleNumberField)}>
                      {RULE_NUMBER_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {getFieldLabel(f)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </>
          )}
        </div>
      )}

      {preview && <p className="rule-preview">Rule: {preview}</p>}

      {!isBuiltin && (
        <label className="settings-field">
          <span className="settings-label">
            {kind === 'ai' ? 'Rule, in plain words' : 'Description'}{' '}
            {kind === 'comparison' && <span className="label-muted">(optional, defaults to the rule above)</span>}
          </span>
          {kind === 'ai' ? (
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. The lease must forbid subletting without the landlord's written consent."
            />
          ) : (
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={preview ?? ''} />
          )}
        </label>
      )}

      <label className="settings-field settings-field-narrow">
        <span className="settings-label">Severity</span>
        <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High (blocks confirm without an override)</option>
        </select>
      </label>

      {error && <p className="form-error-alert" role="alert">{error}</p>}

      <div className="settings-form-actions">
        <button type="button" className="btn btn-subtle" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : rule ? 'Save changes' : 'Save rule'}
        </button>
      </div>
    </form>
  );
}
