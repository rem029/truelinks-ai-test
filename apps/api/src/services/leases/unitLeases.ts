import type { Lease, LeaseRecord } from '@truelinks/shared';
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

export function describeLease(lease: Lease): string {
  const tenant = lease.record.tenant.name.value ?? 'unnamed tenant';
  const term = leaseTerm(lease.record);
  return term ? `${tenant}, ${term.start} to ${term.end}` : tenant;
}

function normalizeName(name: string | null): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
