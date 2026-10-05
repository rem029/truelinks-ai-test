import type { Repositories } from '../../../db/repositories/index.ts';

// Units are fixed by the owner's records, so a lease can only be filed under one of them
export async function isKnownUnit(unitId: unknown, repositories: Repositories): Promise<boolean> {
  if (typeof unitId !== 'string' || unitId.trim() === '') return false;
  return (await repositories.units.get(unitId.trim())) !== null;
}
