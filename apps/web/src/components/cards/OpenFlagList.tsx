import type { Flag } from '@truelinks/shared';

export interface OpenFlagListProps {
  flags: Flag[];
}

export function OpenFlagList({ flags }: OpenFlagListProps) {
  if (flags.length === 0) {
    return <div className="summary-empty">No open flags</div>;
  }

  return (
    <div className="summary-table-wrap">
      <table className="all-fields-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Message</th>
            <th>Field Paths</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((flag) => {
            const severityBadgeClass =
              flag.severity === 'high'
                ? 'badge-fail'
                : flag.severity === 'medium'
                ? 'badge-warn'
                : 'badge-subtle';
            return (
              <tr key={flag.id}>
                <td>
                  <span className={`badge ${severityBadgeClass}`}>
                    {flag.severity}
                  </span>
                </td>
                <td className="cell-muted">{flag.message}</td>
                <td className="cell-mono-muted">
                  {flag.fieldPaths.join(', ') || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
