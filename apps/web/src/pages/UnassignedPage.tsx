import type { ConversationSummary } from '@truelinks/shared';
import { LeaseReviewList } from '../components/units/LeaseReviewList.tsx';

export interface UnassignedPageProps {
  reviews: ConversationSummary[];
}

export function UnassignedPage({ reviews }: UnassignedPageProps) {
  const leases = reviews.filter((r) => r.kind === 'lease' && !r.unitId);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Unassigned leases</h1>
          <p className="page-subtitle">
            Lease reviews whose unit isn't chosen yet. Open one and pick the unit to file it under that unit.
          </p>
        </div>
      </header>
      {leases.length > 0 ? (
        <LeaseReviewList reviews={leases} />
      ) : (
        <div className="empty-state">
          <p>Every lease review has a unit.</p>
        </div>
      )}
    </div>
  );
}
