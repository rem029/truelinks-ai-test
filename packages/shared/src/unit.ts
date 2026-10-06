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

// A unit the owner adds in Settings: it joins an existing building and starts available
export const NewUnit = z.object({
  unitId: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, 'Use capital letters, digits and dashes, e.g. MC-B-1301'),
  label: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(50),
  areaSqm: z.number().positive().max(10000),
  parkingBay: z.string().trim().max(20),
  buildingId: z.string().min(1),
});
export type NewUnit = z.infer<typeof NewUnit>;
