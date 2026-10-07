import { useState } from 'react';
import type { ConversationSummary, Unit } from '@truelinks/shared';
import { Navigate, NavLink, useNavigate, useParams, useSearchParams } from 'react-router';
import { useStartLeaseReview } from '../hooks/useStartLeaseReview.ts';
import { IssueReportList } from '../components/units/IssueReportList.tsx';
import { LeaseReviewList } from '../components/units/LeaseReviewList.tsx';
import { UnitLeasePanel } from '../components/units/UnitLeasePanel.tsx';
import { StatusFilterBar } from '../components/units/StatusFilterBar.tsx';
import { ISSUE_FILTERS, LEASE_FILTERS, isUrgent, knownStatus, matchesStatus } from '../utils/unitFilters.ts';

type UnitTab = 'issues' | 'leases';

export interface UnitPageProps {
  units: Unit[];
  reviews: ConversationSummary[];
  // Reloads the workspace after a row is archived, unarchived or deleted
  onChanged: () => void;
}

const TABS: { id: UnitTab; label: string }[] = [
  { id: 'issues', label: 'Issues' },
  { id: 'leases', label: 'Lease records' },
];

// The URL is /u/<unitId>/<tab>, with the list's filter in ?status= and ?urgent=1 (see utils/unitFilters.ts)
export function UnitPage({ units, reviews, onChanged }: UnitPageProps) {
  const { unitId = '', tab: tabParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const startLeaseReview = useStartLeaseReview();
  const [startError, setStartError] = useState<string | null>(null);
  if (tabParam !== 'issues' && tabParam !== 'leases') return <Navigate to={`/u/${unitId}/issues`} replace />;
  const tab: UnitTab = tabParam;
  const unit = units.find((u) => u.unitId === unitId);
  const unitReviews = reviews.filter((r) => r.unitId === unitId);
  const current = unitReviews.filter((r) => !r.archivedAt);
  const counts: Record<UnitTab, number> = {
    issues: current.filter((r) => r.kind === 'issue').length,
    leases: current.filter((r) => r.kind === 'lease').length,
  };
  const confirmedKey = current
    .filter((r) => r.leaseStatus === 'confirmed')
    .map((r) => r.id)
    .join(',');

  // Filtering runs on the summaries already loaded; server-side paging can replace it when lists grow
  const filters = tab === 'leases' ? LEASE_FILTERS : ISSUE_FILTERS;
  const status = knownStatus(searchParams.get('status') ?? undefined, filters);
  const urgent = tab === 'issues' && searchParams.get('urgent') === '1';
  const tabItems = unitReviews.filter((r) => r.kind === (tab === 'leases' ? 'lease' : 'issue'));
  const shown = tabItems.filter((r) => matchesStatus(r, status, filters) && (!urgent || isUrgent(r)));
  const filtered = status !== undefined || urgent;
  const noun = tab === 'leases' ? 'lease records' : 'issues';
  function setFilter(nextStatus: string | undefined, nextUrgent: boolean) {
    const params = new URLSearchParams();
    if (nextStatus) params.set('status', nextStatus);
    if (nextUrgent) params.set('urgent', '1');
    setSearchParams(params);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title" tabIndex={-1}>{unitId}</h1>
          {unit && (
            <p className="page-subtitle">
              {unit.label} · {unit.buildingName}
            </p>
          )}
        </div>
        {unit && <span className={`badge ${unit.status === 'available' ? 'badge-pass' : 'badge-subtle'}`}>{unit.status}</span>}
      </header>

      {unit && <UnitLeasePanel unit={unit} confirmedKey={confirmedKey} />}

      <nav className="tabs" aria-label={`${unitId} records`}>
        {TABS.map((t) => (
          <NavLink key={t.id} to={`/u/${unitId}/${t.id}`} className={({ isActive }) => `tab ${isActive ? 'is-active' : ''}`}>
            {t.label} <span className="tab-count">{counts[t.id]}</span>
          </NavLink>
        ))}
      </nav>

      <section className="tab-panel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tabItems.length > 0 && (
          <div className="filter-header">
            <StatusFilterBar
              items={tabItems}
              filters={filters}
              status={status}
              urgent={tab === 'issues' ? urgent : null}
              label={`Filter ${noun} by status`}
              onChange={setFilter}
            />
            <p className="filter-summary" aria-live="polite">
              {filtered ? `Showing ${shown.length} of ${tabItems.length} ${noun}` : ''}
            </p>
          </div>
        )}
        {shown.length > 0 &&
          (tab === 'issues' ? (
            <IssueReportList reports={shown} onChanged={onChanged} />
          ) : (
            <LeaseReviewList reviews={shown} onChanged={onChanged} />
          ))}
        {shown.length === 0 && filtered && (
          <div className="empty-state">
            <p>No {noun} match this filter.</p>
            <button type="button" className="btn btn-secondary" onClick={() => setFilter(undefined, false)}>
              Show all
            </button>
          </div>
        )}
        {shown.length === 0 && !filtered && tab === 'issues' && (
          <div className="empty-state">
            <p>No issues reported for this unit.</p>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(`/report/${unitId}`)}>
              Report an issue
            </button>
          </div>
        )}
        {shown.length === 0 && !filtered && tab === 'leases' && (
          <div className="empty-state">
            <p>No lease records for this unit. A lease joins its unit when the review matches it.</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                startLeaseReview().catch((err: unknown) =>
                  setStartError(err instanceof Error ? err.message : String(err))
                )
              }
            >
              New lease review
            </button>
            {startError && (
              <p className="form-error-alert" role="alert">
                {startError}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
