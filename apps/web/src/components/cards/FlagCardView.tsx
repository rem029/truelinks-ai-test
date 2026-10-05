import { useState } from 'react';
import type { FlagCard, Action, FlagReviewStatus } from '@truelinks/shared';

export interface FlagCardViewProps {
  card: FlagCard;
  isInteractive: boolean;
  currentStatus: FlagReviewStatus;
  onAction: (action: Action) => Promise<void>;
}

export function FlagCardView({
  card,
  isInteractive,
  currentStatus,
  onAction,
}: FlagCardViewProps) {
  const [submitting, setSubmitting] = useState<'accept' | 'reject' | null>(null);

  const flag = card.flag;
  const status = currentStatus ?? flag.reviewStatus;

  async function handleAcknowledge() {
    setSubmitting('accept');
    try {
      await onAction({
        type: 'accept',
        cardId: `flag:${flag.id}`,
      });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDismiss() {
    setSubmitting('reject');
    try {
      await onAction({
        type: 'reject',
        cardId: `flag:${flag.id}`,
      });
    } finally {
      setSubmitting(null);
    }
  }

  const severityBadgeClass =
    flag.severity === 'high'
      ? 'badge-fail'
      : flag.severity === 'medium'
      ? 'badge-warn'
      : 'badge-subtle';

  return (
    <div className="card-item flag-card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`badge ${severityBadgeClass}`}>
            {flag.severity.toUpperCase()}
          </span>
          <h4 className="card-title">Flag: {flag.code}</h4>
        </div>
        {status !== 'open' ? (
          <span className="badge badge-subtle">
            {status === 'accepted' ? 'Acknowledged' : 'Dismissed'}
          </span>
        ) : (
          <span className="badge badge-warn">Open</span>
        )}
      </div>

      <p style={{ fontSize: '0.875rem' }}>{flag.message}</p>

      {flag.clauseIds.length > 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Clauses:{' '}
          {flag.clauseIds.map((cid) => (
            <span
              key={cid}
              className="badge badge-subtle"
              style={{ marginRight: '0.25rem', fontFamily: 'var(--font-mono)' }}
            >
              Clause {cid}
            </span>
          ))}
        </div>
      )}

      {isInteractive && status === 'open' && (
        <div className="card-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAcknowledge}
            disabled={submitting !== null}
          >
            {submitting === 'accept' ? 'Acknowledging...' : 'Acknowledge'}
          </button>
          <button
            type="button"
            className="btn btn-subtle btn-sm"
            onClick={handleDismiss}
            disabled={submitting !== null}
          >
            {submitting === 'reject' ? 'Dismissing...' : 'Dismiss'}
          </button>
        </div>
      )}
    </div>
  );
}
