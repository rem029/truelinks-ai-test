import { z } from 'zod';
import { sourcedField } from './sourcedField.ts';
import { RuleResult } from './rules.ts';
import { Flag } from './flag.ts';

export const RentFrequency = z.enum(['monthly', 'quarterly', 'annual']);
export type RentFrequency = z.infer<typeof RentFrequency>;

export const LeaseRecord = z.object({
  landlord: z.object({
    name: sourcedField(z.string()),
    signed: sourcedField(z.boolean()),
  }),
  tenant: z.object({
    name: sourcedField(z.string()),
    signed: sourcedField(z.boolean()),
  }),
  unit: z.object({
    unitId: sourcedField(z.string()),
    label: sourcedField(z.string()),
    parkingBay: sourcedField(z.string()),
  }),
  commencementDate: sourcedField(z.iso.date()),
  expiryDate: sourcedField(z.iso.date()),
  termMonths: sourcedField(z.number()),
  rent: z.object({
    amount: sourcedField(z.number()),
    frequency: sourcedField(RentFrequency),
    monthly: sourcedField(z.number()),
    annual: sourcedField(z.number()),
  }),
  currency: sourcedField(z.string()),
  deposit: sourcedField(z.number()),
  escalation: z.object({
    text: sourcedField(z.string()),
    isDefined: sourcedField(z.boolean()),
  }),
  renewal: sourcedField(z.string()),
  termination: sourcedField(z.string()),
});
export type LeaseRecord = z.infer<typeof LeaseRecord>;

export const LeaseStatus = z.enum(['draft', 'confirmed']);
export type LeaseStatus = z.infer<typeof LeaseStatus>;

// Where a confirmed lease sits on its unit's timeline today; "later" starts after the next one
export const LeaseTiming = z.enum(['active', 'next', 'later', 'ended']);
export type LeaseTiming = z.infer<typeof LeaseTiming>;

// The background full-document analysis (conflicts, judgement concerns) that runs after the fast extraction
export const LeaseAnalysisStatus = z.enum(['pending', 'done', 'failed']);
export type LeaseAnalysisStatus = z.infer<typeof LeaseAnalysisStatus>;

export const Lease = z.object({
  id: z.string(),
  conversationId: z.string(),
  unitId: z.string().nullable(),
  record: LeaseRecord,
  flags: z.array(Flag),
  ruleResults: z.array(RuleResult),
  rulesetVersion: z.string(),
  status: LeaseStatus,
  analysisStatus: LeaseAnalysisStatus,
  overrideReason: z.string().nullable(),
  confirmedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Lease = z.infer<typeof Lease>;
