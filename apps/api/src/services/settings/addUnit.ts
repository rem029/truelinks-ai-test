import type { NewUnit, Unit } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import { HttpError } from '../../utils/httpError.ts';

export async function addUnit(input: NewUnit, repositories: Pick<Repositories, 'units'>): Promise<Unit> {
  const units = await repositories.units.list();
  if (units.some((u) => u.unitId === input.unitId)) {
    throw new HttpError(409, `Unit ${input.unitId} already exists`);
  }
  // Buildings come from the owner's records; a new unit joins one of them
  const building = units.find((u) => u.buildingId === input.buildingId);
  if (!building) {
    throw new HttpError(400, `Building ${input.buildingId} not found`);
  }

  const unit = await repositories.units.create({
    ...input,
    status: 'available',
    buildingId: building.buildingId,
    buildingName: building.buildingName,
    propertyId: building.propertyId,
    propertyName: building.propertyName,
  });
  console.log(`unit add unit=${unit.unitId} building=${unit.buildingId}`);
  return unit;
}
