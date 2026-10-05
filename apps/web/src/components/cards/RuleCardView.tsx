import type { RuleCard, RuleResult } from '@truelinks/shared';

export interface RuleCardViewProps {
  card: RuleCard;
  currentRule?: RuleResult;
}

export function RuleCardView({ card, currentRule }: RuleCardViewProps) {
  const result = currentRule ?? card.result;

  const statusBadgeClass =
    result.status === 'PASS'
      ? 'badge-pass'
      : result.status === 'FAIL'
      ? 'badge-fail'
      : 'badge-warn';

  return (
    <div className="card-item rule-card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`badge ${statusBadgeClass}`}>{result.status}</span>
          <h4 className="card-title">Rule: {result.ruleId}</h4>
          {result.severity && (
            <span className="badge badge-subtle">{result.severity}</span>
          )}
        </div>
      </div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        {result.reason}
      </p>
    </div>
  );
}
