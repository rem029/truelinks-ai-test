import type { ConversationSummary } from '@truelinks/shared';
import { toHash } from '../../utils/router.ts';
import { formatShortDate } from '../../utils/formatters.ts';

export interface LeaseReviewListProps {
  reviews: ConversationSummary[];
}

function describeStatus(review: ConversationSummary): string {
  if (review.leaseStatus === 'confirmed') return 'Confirmed';
  if (review.openItems === null) return 'Draft';
  if (review.openItems === 0) return 'Draft · no open items';
  return `Draft · ${review.openItems} open ${review.openItems === 1 ? 'item' : 'items'}`;
}

export function LeaseReviewList({ reviews }: LeaseReviewListProps) {
  return (
    <ul className="review-list">
      {reviews.map((review) => (
        <li key={review.id}>
          <a className="review-row" href={toHash({ name: 'thread', conversationId: review.id })}>
            <span className="review-row-main">
              <span className="review-row-title review-row-file">{review.filename ?? 'Lease review'}</span>
              <span className="review-row-meta">{formatShortDate(review.createdAt)}</span>
            </span>
            <span className="review-row-badges">
              <span className={`badge ${review.leaseStatus === 'confirmed' ? 'badge-pass' : 'badge-subtle'}`}>
                {describeStatus(review)}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
