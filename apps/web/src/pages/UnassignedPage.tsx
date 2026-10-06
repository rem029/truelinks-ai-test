import type { ConversationSummary } from '@truelinks/shared';
import { LeaseReviewList } from '../components/units/LeaseReviewList.tsx';
import { ArchivedSection } from '../components/units/ArchivedSection.tsx';

export interface UnassignedPageProps {
  reviews: ConversationSummary[];
  onChanged: () => void;
}

export function UnassignedPage({ reviews, onChanged }: UnassignedPageProps) {
  const unassigned = reviews.filter((r) => r.kind === 'lease' && !r.unitId);
  const leases = unassigned.filter((r) => !r.archivedAt);
  const archived = unassigned.filter((r) => r.archivedAt);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title" tabIndex={-1}>Unassigned leases</h1>
          <p className="page-subtitle">
            Lease reviews whose unit isn't chosen yet. Open one and pick the unit to file it under that unit.
          </p>
        </div>
      </header>
      {leases.length > 0 ? (
        <LeaseReviewList reviews={leases} onChanged={onChanged} />
      ) : (
        <div className="empty-state">
          <p>Every lease review has a unit.</p>
        </div>
      )}
      <ArchivedSection count={archived.length}>
        <LeaseReviewList reviews={archived} onChanged={onChanged} />
      </ArchivedSection>
    </div>
  );
}
