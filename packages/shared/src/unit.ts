import { z } from 'zod';

export const UnitStatus = z.enum(['available', 'occupied']);
export type UnitStatus = z.infer<typeof UnitStatus>;

export const Unit = z.object({
  unitId: z.string(),
  label: z.string(),
  type: z.string(),
  areaSqm: z.number(),
  parkingBay: z.string(),
  status: UnitStatus,
  buildingId: z.string(),
  buildingName: z.string(),
  propertyId: z.string(),
  propertyName: z.string(),
});
export type Unit = z.infer<typeof Unit>;
