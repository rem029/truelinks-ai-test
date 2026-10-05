import { useState } from 'react';
import type { FieldCard, Action, SourcedField, LeaseDocument } from '@truelinks/shared';
import {
  getFieldLabel,
  formatFieldValue,
  parseFieldValue,
} from '../../utils/formatters.ts';
import { getDocumentFileUrl } from '../../utils/api.ts';
import { UnitSelect } from '../UnitSelect.tsx';

export interface FieldCardViewProps {
  card: FieldCard;
  isInteractive: boolean;
  currentField?: SourcedField;
  documents: LeaseDocument[];
  onAction: (action: Action) => Promise<void>;
}

export function FieldCardView({
  card,
  isInteractive,
  currentField,
  documents,
  onAction,
}: FieldCardViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState<'accept' | 'reject' | 'edit' | null>(null);

  const field = currentField ?? card.field;
  const [editValue, setEditValue] = useState<string>(
    field.value !== null && field.value !== undefined ? String(field.value) : ''
  );

  const primaryDoc = documents[0];
  let clausePage: number | null = null;
  let clauseText: string | null = null;

  const source = field.source;
  if (source?.type === 'document' && primaryDoc) {
    const clause = primaryDoc.clauses.find((c) => c.id === source.clauseId);
    if (clause) {
      clauseText = clause.heading || `Clause ${clause.id}`;
      if (clause.pages?.start) {
        clausePage = clause.pages.start;
      }
    }
  }

  async function handleAccept() {
    setSubmitting('accept');
    try {
      await onAction({
        type: 'accept',
        cardId: `field:${card.fieldPath}`,
      });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleReject() {
    setSubmitting('reject');
    try {
      await onAction({
        type: 'reject',
        cardId: `field:${card.fieldPath}`,
      });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting('edit');
    try {
      const parsed = parseFieldValue(card.fieldPath, editValue);
      await onAction({
        type: 'edit',
        cardId: `field:${card.fieldPath}`,
        value: parsed,
      });
      setIsEditing(false);
    } finally {
      setSubmitting(null);
    }
  }

  const reviewStatus = field.review.status;
  const statusBadgeClass =
    reviewStatus === 'accepted'
      ? 'badge-pass'
      : reviewStatus === 'rejected'
      ? 'badge-fail'
      : reviewStatus === 'edited'
      ? 'badge-warn'
      : 'badge-subtle';

  const isBooleanField =
    card.fieldPath.endsWith('.signed') || card.fieldPath === 'escalation.isDefined';

  return (
    <div className="card-item field-card">
      <div className="card-header">
        <h4 className="card-title">{getFieldLabel(card.fieldPath)}</h4>
        <span className={`badge ${statusBadgeClass}`}>{reviewStatus}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
        <span style={{ fontSize: '1rem', fontWeight: 600 }}>
          {formatFieldValue(card.fieldPath, field.value)}
        </span>
        {field.confidence !== undefined && field.confidence < 1 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            ({Math.round(field.confidence * 100)}% conf)
          </span>
        )}
      </div>

      {field.source?.type === 'document' && (
        <div className="card-quote-box">
          <div style={{ marginBottom: '0.25rem', fontStyle: 'italic' }}>
            &ldquo;{field.source.quote}&rdquo;
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Clause {field.source.clauseId}</span>
            {primaryDoc && clausePage !== null && (
              <a
                href={getDocumentFileUrl(primaryDoc.id, clausePage)}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.75rem' }}
              >
                Page {clausePage} ↗
              </a>
            )}
          </div>
        </div>
      )}

      {field.source?.type === 'user' && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          from your message
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSaveEdit} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          {card.fieldPath === 'unit.unitId' ? (
            <UnitSelect value={editValue} onChange={setEditValue} disabled={submitting !== null} />
          ) : isBooleanField ? (
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              disabled={submitting !== null}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              disabled={submitting !== null}
              autoFocus
            />
          )}
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={submitting !== null}
          >
            {submitting === 'edit' ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-subtle btn-sm"
            onClick={() => setIsEditing(false)}
            disabled={submitting !== null}
          >
            Cancel
          </button>
        </form>
      ) : (
        isInteractive && (
          <div className="card-actions">
            {field.value !== null && field.value !== undefined && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAccept}
                  disabled={submitting !== null}
                >
                  {submitting === 'accept' ? 'Accepting...' : 'Accept'}
                </button>
                <button
                  type="button"
                  className="btn btn-subtle btn-sm"
                  onClick={handleReject}
                  disabled={submitting !== null}
                >
                  {submitting === 'reject' ? 'Rejecting...' : 'Reject'}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={() => {
                setEditValue(
                  field.value !== null && field.value !== undefined ? String(field.value) : ''
                );
                setIsEditing(true);
              }}
              disabled={submitting !== null}
            >
              Edit
            </button>
          </div>
        )
      )}
    </div>
  );
}
