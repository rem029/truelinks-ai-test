import { useState } from 'react';
import type { ConversationSummary, Unit } from '@truelinks/shared';
import { startLeaseReview } from '../utils/startLeaseReview.ts';
import { navigate, toHash, type UnitTab } from '../utils/router.ts';
import { IssueReportList } from '../components/units/IssueReportList.tsx';
import { LeaseReviewList } from '../components/units/LeaseReviewList.tsx';
import { UnitLeasePanel } from '../components/units/UnitLeasePanel.tsx';
import { StatusFilterBar } from '../components/units/StatusFilterBar.tsx';
import { ISSUE_FILTERS, LEASE_FILTERS, isUrgent, knownStatus, matchesStatus } from '../utils/unitFilters.ts';

export interface UnitPageProps {
  unitId: string;
  tab: UnitTab;
  // From the URL; see utils/unitFilters.ts
  status: string | undefined;
  urgent: boolean;
  unit: Unit | undefined;
  reviews: ConversationSummary[];
  // Reloads the workspace after a row is archived, unarchived or deleted
  onChanged: () => void;
}

const TABS: { id: UnitTab; label: string }[] = [
  { id: 'issues', label: 'Issues' },
  { id: 'leases', label: 'Lease records' },
];

export function UnitPage({ unitId, tab, status: statusParam, urgent: urgentParam, unit, reviews, onChanged }: UnitPageProps) {
  const [startError, setStartError] = useState<string | null>(null);
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
  const status = knownStatus(statusParam, filters);
  const urgent = tab === 'issues' && urgentParam;
  const tabItems = unitReviews.filter((r) => r.kind === (tab === 'leases' ? 'lease' : 'issue'));
  const shown = tabItems.filter((r) => matchesStatus(r, status, filters) && (!urgent || isUrgent(r)));
  const filtered = status !== undefined || urgent;
  const noun = tab === 'leases' ? 'lease records' : 'issues';
  const showAll = () => navigate({ name: 'unit', unitId, tab });

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
          <a
            key={t.id}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`tab ${tab === t.id ? 'is-active' : ''}`}
            href={toHash({ name: 'unit', unitId, tab: t.id })}
          >
            {t.label} <span className="tab-count">{counts[t.id]}</span>
          </a>
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
              onChange={(nextStatus, nextUrgent) =>
                navigate({ name: 'unit', unitId, tab, status: nextStatus, urgent: nextUrgent })
              }
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
            <button type="button" className="btn btn-secondary" onClick={showAll}>
              Show all
            </button>
          </div>
        )}
        {shown.length === 0 && !filtered && tab === 'issues' && (
          <div className="empty-state">
            <p>No issues reported for this unit.</p>
            <button type="button" className="btn btn-secondary" onClick={() => navigate({ name: 'report', unitId })}>
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
