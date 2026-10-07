import type { Lease, LeaseRecord, LeaseTiming } from '@truelinks/shared';
import { monthlyRent } from './rent.ts';

// Dates are ISO yyyy-mm-dd, so string comparison is date comparison
export interface LeaseTerm {
  start: string;
  end: string;
}

export interface UnitLeases {
  // In effect today
  active: Lease | null;
  // The earliest lease that starts after today
  next: Lease | null;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function leaseTerm(record: LeaseRecord): LeaseTerm | null {
  const start = record.commencementDate.value;
  const end = record.expiryDate.value;
  return start && end ? { start, end } : null;
}

export function isInEffect(record: LeaseRecord, today: string): boolean {
  const term = leaseTerm(record);
  return term !== null && term.start <= today && today <= term.end;
}

// Places a unit's confirmed leases on a timeline; confirm guarantees they never overlap
export function placeUnitLeases(confirmedLeases: Lease[], today: string): UnitLeases {
  const active = confirmedLeases.find((lease) => isInEffect(lease.record, today)) ?? null;
  const upcoming = confirmedLeases
    .filter((lease) => (leaseTerm(lease.record)?.start ?? '') > today)
    .sort((a, b) => (a.record.commencementDate.value ?? '').localeCompare(b.record.commencementDate.value ?? ''));
  return { active, next: upcoming[0] ?? null };
}

export function findOverlap(record: LeaseRecord, confirmedLeases: Lease[]): Lease | null {
  const term = leaseTerm(record);
  if (!term) return null;
  return (
    confirmedLeases.find((lease) => {
      const other = leaseTerm(lease.record);
      return other !== null && term.start <= other.end && other.start <= term.end;
    }) ?? null
  );
}

// The same agreement uploaded again: same tenant, start date and monthly rent
export function findDuplicate(record: LeaseRecord, confirmedLeases: Lease[]): Lease | null {
  const tenant = normalizeName(record.tenant.name.value);
  const start = record.commencementDate.value;
  const rent = monthlyRent(record.rent)?.value ?? null;
  if (!tenant || !start || rent === null) return null;
  return (
    confirmedLeases.find(
      (lease) =>
        normalizeName(lease.record.tenant.name.value) === tenant &&
        lease.record.commencementDate.value === start &&
        monthlyRent(lease.record.rent)?.value === rent
    ) ?? null
  );
}

// Where a confirmed lease sits on its unit's timeline today; null for a draft or a lease without dates
export function leaseTiming(lease: Lease, confirmedLeases: Lease[], today: string): LeaseTiming | null {
  if (lease.status !== 'confirmed') return null;
  const { active, next } = placeUnitLeases(confirmedLeases, today);
  if (lease.id === active?.id) return 'active';
  if (lease.id === next?.id) return 'next';
  const term = leaseTerm(lease.record);
  if (!term) return null;
  return term.end < today ? 'ended' : 'later';
}

// Why a lease can't be archived, or null when it can. A draft always can; a confirmed lease only
// once it has ended, so the unit's current and next lease stay on record.
export function archiveBlockedReason(lease: Lease, confirmedLeases: Lease[], today: string): string | null {
  if (lease.status !== 'confirmed') return null;
  const timing = leaseTiming(lease, confirmedLeases, today);
  if (timing === 'active') return "This is the unit's current lease, so it can't be archived";
  if (timing === 'next') return "This is the unit's next lease, so it can't be archived";
  if (timing !== 'ended') return 'A confirmed lease can be archived only after it has ended';
  return null;
}

export function describeLease(lease: Lease): string {
  const tenant = lease.record.tenant.name.value ?? 'unnamed tenant';
  const term = leaseTerm(lease.record);
  return term ? `${tenant}, ${term.start} to ${term.end}` : tenant;
}

function normalizeName(name: string | null): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
