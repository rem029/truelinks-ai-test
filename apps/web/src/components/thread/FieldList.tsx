import { useState } from 'react';
import type { Lease, Action } from '@truelinks/shared';
import { UnitSelect } from '../UnitSelect.tsx';
import {
  listAllFields,
  type FieldPath,
} from '../../utils/leaseFields.ts';
import {
  getFieldLabel,
  formatFieldValue,
  parseFieldValue,
} from '../../utils/formatters.ts';

export interface FieldListProps {
  lease: Lease;
  onEditField?: (fieldPath: FieldPath, value: unknown) => Promise<void>;
  onAction?: (action: Action) => Promise<void>;
  disabled?: boolean;
}

export function FieldList({
  lease,
  onEditField,
  onAction,
  disabled = false,
}: FieldListProps) {
  const [editingPath, setEditingPath] = useState<FieldPath | null>(null);
  const [editValue, setEditValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const allFields = listAllFields(lease.record);

  const openFlags = lease.flags.filter((f) => f.reviewStatus === 'open');
  const flaggedPaths = new Set<string>();
  for (const flag of openFlags) {
    for (const p of flag.fieldPaths) {
      flaggedPaths.add(p);
    }
  }

  function handleStartEdit(path: FieldPath, currentValue: unknown) {
    if (disabled) return;
    setEditingPath(path);
    setEditValue(currentValue !== null && currentValue !== undefined ? String(currentValue) : '');
  }

  async function handleSaveEdit(path: FieldPath) {
    setSubmitting(true);
    try {
      const parsed = parseFieldValue(path, editValue);
      if (onEditField) {
        await onEditField(path, parsed);
      } else if (onAction) {
        await onAction({
          type: 'edit',
          cardId: `field:${path}`,
          value: parsed,
        });
      }
      setEditingPath(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="summary-table-wrap">
      <table className="all-fields-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Value</th>
            <th>Source</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {allFields.map(({ path, field }) => {
            const isEditingThis = editingPath === path;
            // A unit must be picked from the list before it can be saved
            const unitNotPicked = path === 'unit.unitId' && editValue === String(field.value ?? '');
            const isBooleanField =
              path.endsWith('.signed') || path === 'escalation.isDefined';

            let sourceLabel = '—';
            if (field.source?.type === 'document') {
              sourceLabel = `Doc (Cl. ${field.source.clauseId})`;
            } else if (field.source?.type === 'user') {
              sourceLabel = 'User msg';
            }

            const statusBadgeClass =
              field.review.status === 'accepted'
                ? 'badge-pass'
                : field.review.status === 'rejected'
                ? 'badge-fail'
                : field.review.status === 'edited'
                ? 'badge-warn'
                : 'badge-subtle';

            const isFlagged = flaggedPaths.has(path);

            return (
              <tr key={path}>
                <td>{getFieldLabel(path)}</td>
                <td>
                  {isEditingThis ? (
                    path === 'unit.unitId' ? (
                      <UnitSelect value={editValue} onChange={setEditValue} disabled={submitting} />
                    ) : isBooleanField ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        disabled={submitting}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        disabled={submitting}
                        autoFocus
                      />
                    )
                  ) : (
                    <span className="cell-mono">
                      {formatFieldValue(path, field.value)}
                    </span>
                  )}
                </td>
                <td className="cell-muted">
                  {sourceLabel}
                </td>
                <td>
                  <div className="field-status-cell">
                    <span className={`badge ${statusBadgeClass}`}>
                      {field.review.status}
                    </span>
                    {isFlagged && (
                      <span className="badge badge-fail flagged-marker" title="Referenced by open flag">
                        Flagged
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  {isEditingThis ? (
                    <div className="field-actions-inline">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveEdit(path)}
                        disabled={submitting || unitNotPicked}
                      >
                        {submitting ? '...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-subtle btn-sm"
                        onClick={() => setEditingPath(null)}
                        disabled={submitting}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-subtle btn-sm"
                      onClick={() => handleStartEdit(path, field.value)}
                      disabled={disabled}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
