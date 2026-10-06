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

// A confirmed lease as the unit page shows it; months left are worked out where it is displayed
export const UnitLeaseSummary = z.object({
  leaseId: z.string(),
  conversationId: z.string(),
  tenant: z.string().nullable(),
  commencementDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  monthlyRent: z.number().nullable(),
  deposit: z.number().nullable(),
  currency: z.string().nullable(),
});
export type UnitLeaseSummary = z.infer<typeof UnitLeaseSummary>;

// Confirmed leases never overlap, so a unit has at most one lease in effect and one lined up next
export const UnitLeases = z.object({
  active: UnitLeaseSummary.nullable(),
  next: UnitLeaseSummary.nullable(),
});
export type UnitLeases = z.infer<typeof UnitLeases>;
