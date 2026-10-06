import type { ConversationSummary } from '@truelinks/shared';
import { toHash } from '../../utils/router.ts';
import { formatShortDate } from '../../utils/formatters.ts';
import { ArchiveActions } from '../ArchiveActions.tsx';

export interface IssueReportListProps {
  reports: ConversationSummary[];
  onChanged: () => void;
}

const STATUS_BADGE = { draft: 'badge-subtle', accepted: 'badge-pass', rejected: 'badge-fail' } as const;

export function IssueReportList({ reports, onChanged }: IssueReportListProps) {
  return (
    <ul className="review-list">
      {reports.map((report) => {
        const workOrder = report.workOrder;
        return (
          <li key={report.id} className="review-item">
            <a className="review-row" href={toHash({ name: 'thread', conversationId: report.id })}>
              <span className="review-row-main">
                <span className="review-row-title">{workOrder ? workOrder.title : 'No work order'}</span>
                <span className="review-row-meta">
                  {formatShortDate(report.createdAt)} · {report.photoCount ?? 0}{' '}
                  {report.photoCount === 1 ? 'photo' : 'photos'}
                </span>
              </span>
              <span className="review-row-badges">
                {workOrder?.urgent && <span className="badge badge-fail">urgent</span>}
                {workOrder && <span className="badge badge-subtle">{workOrder.severity}</span>}
                {workOrder && <span className={`badge ${STATUS_BADGE[workOrder.status]}`}>{workOrder.status}</span>}
              </span>
            </a>
            <ArchiveActions
              conversationId={report.id}
              kind="issue"
              archivedAt={report.archivedAt}
              archiveBlockedReason={report.archiveBlockedReason}
              itemName={workOrder ? workOrder.title : 'issue report'}
              onChanged={onChanged}
              onDeleted={onChanged}
            />
          </li>
        );
      })}
    </ul>
  );
}
