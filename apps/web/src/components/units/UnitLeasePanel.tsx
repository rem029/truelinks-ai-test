import { useEffect, useState } from 'react';
import type { Unit, UnitLeases, UnitLeaseSummary } from '@truelinks/shared';
import { getUnitLeases } from '../../utils/api.ts';
import { Link } from 'react-router';
import { formatLeaseDate, formatMoney, monthsBetweenDates } from '../../utils/formatters.ts';

export interface UnitLeasePanelProps {
  unit: Unit;
  // Changes when a lease on this unit is confirmed, so the panel reloads
  confirmedKey: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function describeTiming(lease: UnitLeaseSummary, kind: 'current' | 'next'): string | null {
  const today = todayIso();
  if (kind === 'current' && lease.expiryDate) {
    return `${plural(monthsBetweenDates(today, lease.expiryDate), 'month')} left`;
  }
  if (kind === 'next' && lease.commencementDate) {
    return `starts in ${plural(monthsBetweenDates(today, lease.commencementDate), 'month')}`;
  }
  return null;
}

function LeaseCard({ lease, kind }: { lease: UnitLeaseSummary; kind: 'current' | 'next' }) {
  const title = kind === 'current' ? 'Current lease' : 'Next lease';
  const headingId = `unit-lease-${kind}`;
  const timing = describeTiming(lease, kind);

  return (
    <section className={`unit-lease unit-lease-${kind}`} aria-labelledby={headingId}>
      <h2 id={headingId} className="unit-lease-eyebrow">
        {title}
      </h2>
      <p className="unit-lease-tenant">{lease.tenant ?? 'Tenant not named'}</p>
      <dl className="unit-lease-facts">
        <div>
          <dt>Term</dt>
          <dd>
            {lease.commencementDate && lease.expiryDate
              ? `${formatLeaseDate(lease.commencementDate)} – ${formatLeaseDate(lease.expiryDate)}`
              : '—'}
            {timing && <span className="unit-lease-timing"> · {timing}</span>}
          </dd>
        </div>
        <div>
          <dt>Monthly rent</dt>
          <dd>{formatMoney(lease.monthlyRent, lease.currency)}</dd>
        </div>
        <div>
          <dt>Deposit</dt>
          <dd>{formatMoney(lease.deposit, lease.currency)}</dd>
        </div>
      </dl>
      <Link className="unit-lease-link" to={`/c/${lease.conversationId}`}>
        Open lease record
      </Link>
    </section>
  );
}

export function UnitLeasePanel({ unit, confirmedKey }: UnitLeasePanelProps) {
  const [leases, setLeases] = useState<UnitLeases | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUnitLeases(unit.unitId)
      .then((result) => {
        if (!cancelled) {
          setLeases(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [unit.unitId, confirmedKey]);

  if (error) {
    return (
      <p className="form-error-alert" role="alert">
        Could not load this unit's leases: {error}
      </p>
    );
  }
  if (!leases) {
    return null;
  }
  if (!leases.active && !leases.next) {
    return unit.status === 'occupied' ? (
      <p className="unit-lease-missing">Marked occupied, but no confirmed lease is in effect. Review the tenant's lease to keep the record complete.</p>
    ) : null;
  }

  return (
    <div className="unit-leases">
      {leases.active && <LeaseCard lease={leases.active} kind="current" />}
      {leases.next && <LeaseCard lease={leases.next} kind="next" />}
    </div>
  );
}
