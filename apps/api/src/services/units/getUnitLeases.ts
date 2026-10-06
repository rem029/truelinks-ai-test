import type { Lease, UnitLeases, UnitLeaseSummary } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { HttpError } from '../../utils/httpError.ts';
import { monthlyRent } from '../leases/rent.ts';
import { placeUnitLeases, todayIso } from '../leases/unitLeases.ts';

function toSummary(lease: Lease): UnitLeaseSummary {
  const { record } = lease;
  return {
    leaseId: lease.id,
    conversationId: lease.conversationId,
    tenant: record.tenant.name.value,
    commencementDate: record.commencementDate.value,
    expiryDate: record.expiryDate.value,
    monthlyRent: monthlyRent(record.rent)?.value ?? null,
    deposit: record.deposit.value,
    currency: record.currency.value,
  };
}

export async function getUnitLeases(unitId: string, repositories: Repositories): Promise<UnitLeases> {
  if (!(await repositories.units.get(unitId))) {
    throw new HttpError(404, `Unit ${unitId} not found`);
  }
  const confirmed = (await repositories.leases.listByUnit(unitId)).filter((lease) => lease.status === 'confirmed');
  const { active, next } = placeUnitLeases(confirmed, todayIso());
  return { active: active && toSummary(active), next: next && toSummary(next) };
}
