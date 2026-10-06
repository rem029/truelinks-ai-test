import { useState } from 'react';
import type { ConversationSummary, Unit } from '@truelinks/shared';
import { startLeaseReview } from '../utils/startLeaseReview.ts';
import { navigate, toHash, type UnitTab } from '../utils/router.ts';
import { IssueReportList } from '../components/units/IssueReportList.tsx';
import { LeaseReviewList } from '../components/units/LeaseReviewList.tsx';
import { UnitLeasePanel } from '../components/units/UnitLeasePanel.tsx';
import { ArchivedSection } from '../components/units/ArchivedSection.tsx';

export interface UnitPageProps {
  unitId: string;
  tab: UnitTab;
  unit: Unit | undefined;
  reviews: ConversationSummary[];
  // Reloads the workspace after a row is archived, unarchived or deleted
  onChanged: () => void;
}

const TABS: { id: UnitTab; label: string }[] = [
  { id: 'issues', label: 'Issues' },
  { id: 'leases', label: 'Lease records' },
];

export function UnitPage({ unitId, tab, unit, reviews, onChanged }: UnitPageProps) {
  const [startError, setStartError] = useState<string | null>(null);
  const unitReviews = reviews.filter((r) => r.unitId === unitId);
  const archived = unitReviews.filter((r) => r.archivedAt);
  const current = unitReviews.filter((r) => !r.archivedAt);
  const issues = current.filter((r) => r.kind === 'issue');
  const leases = current.filter((r) => r.kind === 'lease');
  const archivedIssues = archived.filter((r) => r.kind === 'issue');
  const archivedLeases = archived.filter((r) => r.kind === 'lease');
  const counts: Record<UnitTab, number> = { issues: issues.length, leases: leases.length };
  const confirmedKey = leases
    .filter((r) => r.leaseStatus === 'confirmed')
    .map((r) => r.id)
    .join(',');

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
        {tab === 'issues' &&
          (issues.length > 0 ? (
            <IssueReportList reports={issues} onChanged={onChanged} />
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
            <LeaseReviewList reviews={leases} onChanged={onChanged} />
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
        {tab === 'issues' && (
          <ArchivedSection count={archivedIssues.length}>
            <IssueReportList reports={archivedIssues} onChanged={onChanged} />
          </ArchivedSection>
        )}
        {tab === 'leases' && (
          <ArchivedSection count={archivedLeases.length}>
            <LeaseReviewList reviews={archivedLeases} onChanged={onChanged} />
          </ArchivedSection>
        )}
      </section>
    </div>
  );
}
