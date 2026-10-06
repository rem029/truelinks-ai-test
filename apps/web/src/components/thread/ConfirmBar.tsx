import { useState } from 'react';
import type { Lease, ConversationReview } from '@truelinks/shared';

export interface ConfirmBarProps {
  lease: Lease;
  review: ConversationReview | null;
  onConfirm: (overrideReason?: string) => Promise<void>;
  disabled: boolean;
}

export function ConfirmBar({ lease, review, onConfirm, disabled }: ConfirmBarProps) {
  const [showPending, setShowPending] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isConfirmed = lease.status === 'confirmed';

  if (isConfirmed) {
    return (
      <div className="confirm-bar">
        <div className="confirm-bar-done">
          <span className="confirm-bar-done-label">✓ Lease confirmed</span>
          {lease.unitId && <span>· Unit {lease.unitId} marked occupied</span>}
          {lease.overrideReason && <span>· Override: &ldquo;{lease.overrideReason}&rdquo;</span>}
        </div>
      </div>
    );
  }

  const pending = review?.pending ?? [];
  const failures = review?.highSeverityFailures ?? [];
  const hasFailures = failures.length > 0;
  const isPendingBlocked = pending.length > 0;
  const isOverrideRequired = hasFailures && !overrideReason.trim();
  const canConfirm = !isPendingBlocked && !isOverrideRequired && !disabled && !submitting;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm(hasFailures ? overrideReason.trim() : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="confirm-bar">
      <div className="confirm-bar-main">
        <div className="confirm-bar-status">
          {pending.length === 0 ? (
            <span className="confirm-bar-ready">
              ✓ Ready to confirm
            </span>
          ) : (
            <button
              type="button"
              className="confirm-pending-toggle"
              onClick={() => setShowPending((prev) => !prev)}
            >
              {pending.length} open {pending.length === 1 ? 'item' : 'items'}{' '}
              <span>{showPending ? '▴' : '▾'}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {submitting ? 'Confirming...' : 'Confirm lease'}
        </button>
      </div>

      {showPending && pending.length > 0 && (
        <ul className="confirm-pending-list">
          {pending.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}

      {hasFailures && pending.length === 0 && (
        <div className="confirm-override-area">
          <label className="confirm-override-label">
            High-severity rule failure requires override reason:
          </label>
          <div className="confirm-override-failures">
            {failures.map((f) => `${f.ruleId}: ${f.reason}`).join(' | ')}
          </div>
          <textarea
            rows={2}
            placeholder="State why this lease is being confirmed despite the rule failure..."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            disabled={disabled || submitting}
          />
        </div>
      )}
    </div>
  );
}
