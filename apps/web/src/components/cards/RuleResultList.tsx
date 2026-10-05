import type { RuleResult } from '@truelinks/shared';

export interface RuleResultListProps {
  ruleResults: RuleResult[];
}

export function RuleResultList({ ruleResults }: RuleResultListProps) {
  if (ruleResults.length === 0) {
    return <div className="summary-empty">No rule results</div>;
  }

  return (
    <div className="summary-table-wrap">
      <table className="all-fields-table">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {ruleResults.map((rule) => {
            const statusBadgeClass =
              rule.status === 'PASS'
                ? 'badge-pass'
                : rule.status === 'FAIL'
                ? 'badge-fail'
                : 'badge-warn';
            return (
              <tr key={rule.ruleId}>
                <td className="cell-mono">{rule.ruleId}</td>
                <td>
                  <span className="badge badge-subtle">{rule.severity}</span>
                </td>
                <td>
                  <span className={`badge ${statusBadgeClass}`}>
                    {rule.status}
                  </span>
                </td>
                <td className="cell-muted">{rule.reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
