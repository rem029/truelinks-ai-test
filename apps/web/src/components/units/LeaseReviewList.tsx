import type { ConversationSummary } from '@truelinks/shared';
import { Link } from 'react-router';
import { formatShortDate } from '../../utils/formatters.ts';
import { ArchiveActions } from '../ArchiveActions.tsx';

export interface LeaseReviewListProps {
  reviews: ConversationSummary[];
  onChanged: () => void;
}

function describeStatus(review: ConversationSummary): string {
  if (review.leaseStatus === 'confirmed') return 'Confirmed';
  if (review.openItems === null) return 'Draft';
  if (review.openItems === 0) return 'Draft · no open items';
  return `Draft · ${review.openItems} open ${review.openItems === 1 ? 'item' : 'items'}`;
}

export function LeaseReviewList({ reviews, onChanged }: LeaseReviewListProps) {
  return (
    <ul className="review-list">
      {reviews.map((review) => (
        <li key={review.id} className="review-item">
          <Link className="review-row" to={`/c/${review.id}`}>
            <span className="review-row-main">
              <span className="review-row-title review-row-file">{review.filename ?? 'Lease review'}</span>
              <span className="review-row-meta">{formatShortDate(review.createdAt)}</span>
            </span>
            <span className="review-row-badges">
              <span className={`badge ${review.leaseStatus === 'confirmed' ? 'badge-pass' : 'badge-subtle'}`}>
                {describeStatus(review)}
              </span>
            </span>
          </Link>
          <ArchiveActions
            conversationId={review.id}
            kind="lease"
            archivedAt={review.archivedAt}
            archiveBlockedReason={review.archiveBlockedReason}
            itemName={review.filename ?? 'lease review'}
            onChanged={onChanged}
            onDeleted={onChanged}
          />
        </li>
      ))}
    </ul>
  );
}
