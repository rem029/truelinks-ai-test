import { useState } from 'react';
import type { Lease } from '@truelinks/shared';
import {
  listAllFields,
  type FieldPath,
} from '../../utils/leaseFields.ts';
import {
  getFieldLabel,
  formatFieldValue,
  parseFieldValue,
} from '../../utils/formatters.ts';

export interface AllFieldsPanelProps {
  lease: Lease;
  onEditField: (fieldPath: FieldPath, value: unknown) => Promise<void>;
  disabled: boolean;
}

export function AllFieldsPanel({
  lease,
  onEditField,
  disabled,
}: AllFieldsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<FieldPath | null>(null);
  const [editValue, setEditValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const allFields = listAllFields(lease.record);
  const acceptedCount = allFields.filter(
    (f) => f.field.review.status === 'accepted'
  ).length;

  function handleStartEdit(path: FieldPath, currentValue: unknown) {
    if (disabled) return;
    setEditingPath(path);
    setEditValue(currentValue !== null && currentValue !== undefined ? String(currentValue) : '');
  }

  async function handleSaveEdit(path: FieldPath) {
    setSubmitting(true);
    try {
      const parsed = parseFieldValue(path, editValue);
      await onEditField(path, parsed);
      setEditingPath(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="all-fields-panel">
      <div
        className="all-fields-summary"
        onClick={() => setIsOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
      >
        <div>
          <span>All 20 fields</span>{' '}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
            ({acceptedCount}/20 accepted)
          </span>
        </div>
        <span>{isOpen ? '▴ Hide' : '▾ Show'}</span>
      </div>

      {isOpen && (
        <div style={{ overflowX: 'auto' }}>
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

                return (
                  <tr key={path}>
                    <td style={{ fontWeight: 500 }}>{getFieldLabel(path)}</td>
                    <td>
                      {isEditingThis ? (
                        isBooleanField ? (
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
                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatFieldValue(path, field.value)}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {sourceLabel}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass}`}>
                        {field.review.status}
                      </span>
                    </td>
                    <td>
                      {isEditingThis ? (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSaveEdit(path)}
                            disabled={submitting}
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
      )}
    </div>
  );
}
