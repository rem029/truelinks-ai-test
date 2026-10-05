import { useState } from 'react';
import type { SummaryCard, Action, Lease } from '@truelinks/shared';
import { listAllFields } from '../../utils/leaseFields.ts';
import { FieldList } from '../thread/FieldList.tsx';
import { RuleResultList } from './RuleResultList.tsx';
import { OpenFlagList } from './OpenFlagList.tsx';

export interface SummaryCardViewProps {
  card: SummaryCard;
  isInteractive: boolean;
  lease?: Lease | null;
  onAction: (action: Action) => Promise<void>;
}

export function SummaryCardView({
  card,
  isInteractive,
  lease,
  onAction,
}: SummaryCardViewProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleAcceptAll() {
    setSubmitting(true);
    try {
      await onAction({ type: 'acceptAll' });
    } finally {
      setSubmitting(false);
    }
  }

  const count = card.acceptAllCount ?? 0;
  const hasLeaseDetails = isInteractive && !!lease;

  // Counts computed from lease when interactive
  const allFields = lease ? listAllFields(lease.record) : [];
  const foundCount = allFields.filter(({ field }) => field.value !== null).length;
  const fieldsSummaryText = `Fields: ${foundCount}/${allFields.length} found`;

  const passCount = lease?.ruleResults.filter((r) => r.status === 'PASS').length ?? 0;
  const failCount = lease?.ruleResults.filter((r) => r.status === 'FAIL').length ?? 0;
  const notDetCount = lease?.ruleResults.filter((r) => r.status === 'NOT_DETERMINABLE').length ?? 0;
  const rulesSummaryText = `Rules: ${passCount} pass / ${failCount} fail / ${notDetCount} not determinable`;

  const openFlags = lease?.flags.filter((f) => f.reviewStatus === 'open') ?? [];
  const flagsSummaryText =
    openFlags.length === 0
      ? 'No open flags'
      : openFlags.length === 1
      ? '1 open flag'
      : `${openFlags.length} open flags`;

  // Explicit plain lines when interactive
  const fineLine = card.lines.find(
    (line) => line.endsWith('look fine') || line.endsWith('looks fine')
  );
  const plainLines: string[] = [];
  if (lease?.analysisStatus === 'pending') {
    plainLines.push('Full review still running');
  }
  if (fineLine) {
    plainLines.push(fineLine);
  }

  return (
    <div className="card-item summary-card">
      <div className="card-header">
        <h4 className="card-title">{card.title}</h4>
        <span className="badge badge-subtle">Summary</span>
      </div>

      {hasLeaseDetails ? (
        <div className="summary-details-list">
          {/* 1. Fields collapsible row */}
          <details className="summary-details-row">
            <summary className="summary-details-summary">
              {fieldsSummaryText}
            </summary>
            <div className="summary-details-content">
              <FieldList
                lease={lease}
                onAction={onAction}
                disabled={!isInteractive}
              />
            </div>
          </details>

          {/* 2. Rules collapsible row */}
          <details className="summary-details-row">
            <summary className="summary-details-summary">
              {rulesSummaryText}
            </summary>
            <div className="summary-details-content">
              <RuleResultList ruleResults={lease.ruleResults} />
            </div>
          </details>

          {/* 3. Open flags collapsible row */}
          <details className="summary-details-row">
            <summary className="summary-details-summary">
              {flagsSummaryText}
            </summary>
            <div className="summary-details-content">
              <OpenFlagList flags={openFlags} />
            </div>
          </details>

          {/* Explicit plain lines */}
          {plainLines.length > 0 && (
            <ul className="summary-plain-list">
              {plainLines.map((line, idx) => (
                <li key={idx} className="summary-plain-item">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* Older (non-latest) summary cards keep their stored text lines only */
        card.lines.length > 0 && (
          <ul className="summary-plain-list">
            {card.lines.map((line, idx) => (
              <li key={idx} className="summary-plain-item">
                {line}
              </li>
            ))}
          </ul>
        )
      )}

      {isInteractive && (
        <div className="card-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAcceptAll}
            disabled={submitting || count === 0}
            title={count === 0 ? 'Nothing left to accept' : undefined}
          >
            {submitting ? 'Accepting...' : `Accept all (${count})`}
          </button>
        </div>
      )}
    </div>
  );
}
