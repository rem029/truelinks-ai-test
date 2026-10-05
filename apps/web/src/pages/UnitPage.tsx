import { useState } from 'react';
import type { ConversationSummary, Unit } from '@truelinks/shared';
import { startLeaseReview } from '../utils/startLeaseReview.ts';
import { navigate, toHash, type UnitTab } from '../utils/router.ts';
import { IssueReportList } from '../components/units/IssueReportList.tsx';
import { LeaseReviewList } from '../components/units/LeaseReviewList.tsx';

export interface UnitPageProps {
  unitId: string;
  tab: UnitTab;
  unit: Unit | undefined;
  reviews: ConversationSummary[];
}

const TABS: { id: UnitTab; label: string }[] = [
  { id: 'issues', label: 'Issues' },
  { id: 'leases', label: 'Lease records' },
];

export function UnitPage({ unitId, tab, unit, reviews }: UnitPageProps) {
  const [startError, setStartError] = useState<string | null>(null);
  const unitReviews = reviews.filter((r) => r.unitId === unitId);
  const issues = unitReviews.filter((r) => r.kind === 'issue');
  const leases = unitReviews.filter((r) => r.kind === 'lease');
  const counts: Record<UnitTab, number> = { issues: issues.length, leases: leases.length };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{unitId}</h1>
          {unit && (
            <p className="page-subtitle">
              {unit.label} · {unit.buildingName}
            </p>
          )}
        </div>
        {unit && <span className={`badge ${unit.status === 'occupied' ? 'badge-accent' : 'badge-subtle'}`}>{unit.status}</span>}
      </header>

      <div className="tabs" role="tablist" aria-label={`${unitId} records`}>
        {TABS.map((t) => (
          <a
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`tab ${tab === t.id ? 'is-active' : ''}`}
            href={toHash({ name: 'unit', unitId, tab: t.id })}
          >
            {t.label} <span className="tab-count">{counts[t.id]}</span>
          </a>
        ))}
      </div>

      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
        {tab === 'issues' &&
          (issues.length > 0 ? (
            <IssueReportList reports={issues} />
          ) : (
            <div className="empty-state">
              <p>No issues reported for this unit.</p>
              <button type="button" className="btn btn-secondary" onClick={() => navigate({ name: 'report', unitId })}>
                Report an issue
              </button>
            </div>
          ))}
        {tab === 'leases' &&
          (leases.length > 0 ? (
            <LeaseReviewList reviews={leases} />
          ) : (
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
          ))}
      </section>
    </div>
  );
}
