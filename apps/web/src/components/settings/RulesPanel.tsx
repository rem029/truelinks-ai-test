import { useEffect, useState } from 'react';
import { nextRulesetVersion, type Rule, type Ruleset, type RulesetVersion } from '@truelinks/shared';
import { deleteRule, listRulesetVersions, restoreRulesetVersion } from '../../utils/api.ts';
import { formatShortDate } from '../../utils/formatters.ts';
import { BackIcon, PlusIcon } from '../icons.tsx';
import { RuleForm } from './RuleForm.tsx';

const CHECKED_BY: Record<Rule['kind'], string> = {
  builtin: 'Checked by code',
  comparison: 'Checked by code',
  ai: 'Judged by the AI, quote verified by code',
};

const SEVERITY_BADGE = { high: 'badge-fail', medium: 'badge-warn', low: 'badge-subtle' } as const;

type View = { name: 'list' } | { name: 'add' } | { name: 'edit'; rule: Rule };

// Versions saved before change notes existed have none; only the oldest was imported from the owner's file
function describeVersion(v: RulesetVersion, isCurrent: boolean, isOldest: boolean): string {
  const note = v.changeNote || (isOldest ? "Imported from the owner's file" : 'Changed');
  return `${v.version} · ${note} · ${formatShortDate(v.createdAt)}${isCurrent ? ' (current)' : ''}`;
}

export function RulesPanel() {
  const [versions, setVersions] = useState<RulesetVersion[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: 'list' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload(message: string | null) {
    const list = await listRulesetVersions();
    setVersions(list);
    setSelected(null);
    setNotice(message);
  }

  useEffect(() => {
    let active = true;
    listRulesetVersions()
      .then((list) => {
        if (active) setVersions(list);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  if (!versions) {
    return error ? <p className="form-error-alert">Couldn't load rules: {error}</p> : <p className="settings-muted">Loading rules…</p>;
  }
  const current = versions[0];
  if (!current) return <p className="settings-muted">No rules yet.</p>;
  const shown = versions.find((v) => v.version === selected) ?? current;
  const isCurrent = shown.version === current.version;

  // Each change answers with the new current version; refresh the history so the picker shows it
  async function afterChange(saved: Ruleset, what: string) {
    setView({ name: 'list' });
    setConfirmDelete(null);
    await reload(`${what}. The ruleset is now version ${saved.version}.`);
  }

  async function run(action: () => Promise<Ruleset>, what: string) {
    setBusy(true);
    setError(null);
    try {
      await afterChange(await action(), what);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (view.name !== 'list') {
    const editing = view.name === 'edit' ? view.rule : undefined;
    return (
      <section aria-labelledby="rule-form-heading" className="settings-view">
        <button type="button" className="settings-back" onClick={() => setView({ name: 'list' })}>
          <BackIcon /> Rules
        </button>
        <h3 id="rule-form-heading" className="settings-view-title">
          {editing ? `Edit ${editing.id}` : 'Add a rule'}
        </h3>
        <p className="settings-lede">
          Saving creates version {nextRulesetVersion(current.version)}; leases already reviewed keep the version they were checked against.
        </p>
        <RuleForm
          rule={editing}
          onCancel={() => setView({ name: 'list' })}
          onSaved={(saved) => void afterChange(saved, editing ? `Saved ${editing.id}` : `Added ${saved.rules[saved.rules.length - 1]?.id ?? 'the rule'}`)}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="rules-heading" className="settings-view">
      <div className="settings-view-header">
        <div>
          <h3 id="rules-heading" className="settings-view-title">
            {shown.name}
          </h3>
          <p className="settings-lede">
            Version {shown.version} · {shown.rules.length} rules.{' '}
            {isCurrent ? 'Every new lease is checked against all of them.' : 'An earlier version, shown read-only.'}
          </p>
        </div>
        {isCurrent && (
          <button type="button" className="btn btn-primary" onClick={() => { setView({ name: 'add' }); setNotice(null); }}>
            <PlusIcon /> Add rule
          </button>
        )}
      </div>

      <label className="settings-field settings-version-picker">
        <span className="settings-label">Version</span>
        <select value={shown.version} onChange={(e) => { setSelected(e.target.value); setNotice(null); setConfirmDelete(null); }}>
          {versions.map((v, i) => (
            <option key={v.version} value={v.version}>
              {describeVersion(v, i === 0, i === versions.length - 1)}
            </option>
          ))}
        </select>
      </label>

      {!isCurrent && (
        <div className="settings-banner">
          <p>
            Leases checked against version {shown.version} keep it. Restoring saves a copy of it as version {nextRulesetVersion(current.version)}.
          </p>
          <button
            type="button"
            className="btn btn-subtle"
            disabled={busy}
            onClick={() => void run(() => restoreRulesetVersion(shown.version), `Restored version ${shown.version}`)}
          >
            Restore this version
          </button>
        </div>
      )}

      {notice && (
        <p className="settings-success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-error-alert" role="alert">
          {error}
        </p>
      )}

      <ul className="rule-list">
        {shown.rules.map((rule) => (
          <li key={rule.id} className="rule-list-item">
            <span className="rule-list-id">{rule.id}</span>
            <div className="rule-list-body">
              <p className="rule-list-description">{rule.description}</p>
              <p className="rule-list-meta">
                {CHECKED_BY[rule.kind]}
                {rule.kind === 'comparison' && <span className="rule-list-check">{rule.check}</span>}
              </p>
              {confirmDelete === rule.id && (
                <div className="rule-list-confirm" role="group" aria-label={`Delete ${rule.id}?`}>
                  <span>
                    Delete {rule.id}? This saves version {nextRulesetVersion(current.version)}.
                  </span>
                  <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => void run(() => deleteRule(rule.id), `Deleted ${rule.id}`)}>
                    Yes, delete {rule.id}
                  </button>
                  <button type="button" className="btn btn-subtle btn-sm" onClick={() => setConfirmDelete(null)}>
                    Keep it
                  </button>
                </div>
              )}
            </div>
            <div className="rule-list-side">
              <span className={`badge ${SEVERITY_BADGE[rule.severity]}`}>{rule.severity}</span>
              {isCurrent && (
                <span className="rule-list-actions">
                  <button type="button" className="link-button" onClick={() => { setView({ name: 'edit', rule }); setNotice(null); }} aria-label={`Edit ${rule.id}`}>
                    Edit
                  </button>
                  <button type="button" className="link-button" onClick={() => { setConfirmDelete(rule.id); setNotice(null); }} aria-label={`Delete ${rule.id}`}>
                    Delete
                  </button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
