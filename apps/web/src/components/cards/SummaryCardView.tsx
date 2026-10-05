import { useState } from 'react';
import type { SummaryCard, Action } from '@truelinks/shared';

export interface SummaryCardViewProps {
  card: SummaryCard;
  isInteractive: boolean;
  onAction: (action: Action) => Promise<void>;
}

export function SummaryCardView({ card, isInteractive, onAction }: SummaryCardViewProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleAcceptAll() {
    setSubmitting(true);
    try {
      await onAction({ type: 'acceptAll' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-item summary-card">
      <div className="card-header">
        <h4 className="card-title">{card.title}</h4>
        <span className="badge badge-subtle">Summary</span>
      </div>
      {card.lines.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
          {card.lines.map((line, idx) => (
            <li key={idx} style={{ marginBottom: '0.25rem' }}>
              {line}
            </li>
          ))}
        </ul>
      )}
      {isInteractive && (
        <div className="card-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAcceptAll}
            disabled={submitting}
          >
            {submitting ? 'Accepting...' : 'Accept all'}
          </button>
        </div>
      )}
    </div>
  );
}
