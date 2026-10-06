import { z } from 'zod';

// The model breaks on union or nullable types in JSON schema, so each property uses a single concrete type.
function extracted<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    found: z.boolean(),
    value: valueSchema,
    clauseId: z.string(),
    quote: z.string(),
    confidence: z.number().min(0).max(1),
  });
}

export const ExtractedText = extracted(z.string());
export type ExtractedText = z.infer<typeof ExtractedText>;

export const ExtractedNumber = extracted(z.number());
export type ExtractedNumber = z.infer<typeof ExtractedNumber>;

export const ExtractedBoolean = extracted(z.boolean());
export type ExtractedBoolean = z.infer<typeof ExtractedBoolean>;

export const ExtractedFields = z.object({
  landlord: z.object({
    name: ExtractedText,
    signed: ExtractedBoolean,
  }),
  tenant: z.object({
    name: ExtractedText,
    signed: ExtractedBoolean,
  }),
  unit: z.object({
    unitId: ExtractedText,
    label: ExtractedText,
    parkingBay: ExtractedText,
  }),
  commencementDate: ExtractedText,
  expiryDate: ExtractedText,
  termMonths: ExtractedNumber,
  rent: z.object({
    amount: ExtractedNumber,
    frequency: ExtractedText,
    monthly: ExtractedNumber,
    annual: ExtractedNumber,
  }),
  currency: ExtractedText,
  deposit: ExtractedNumber,
  escalation: z.object({
    text: ExtractedText,
    isDefined: ExtractedBoolean,
  }),
  renewal: ExtractedText,
  termination: ExtractedText,
});
export type ExtractedFields = z.infer<typeof ExtractedFields>;

export const ExtractionCandidate = z.object({
  value: z.string(),
  clauseId: z.string(),
  quote: z.string(),
});
export type ExtractionCandidate = z.infer<typeof ExtractionCandidate>;

export const ExtractionConflict = z.object({
  fieldPath: z.string(),
  candidates: z.array(ExtractionCandidate),
});
export type ExtractionConflict = z.infer<typeof ExtractionConflict>;

export const ExtractionConcern = z.object({
  fieldPath: z.string(),
  clauseId: z.string(),
  message: z.string(),
});
export type ExtractionConcern = z.infer<typeof ExtractionConcern>;

// The model's verdict on one of the owner's plain-language rules; code verifies the quote before using it
export const OwnerRuleJudgement = z.object({
  ruleId: z.string(),
  status: z.enum(['PASS', 'FAIL', 'NOT_DETERMINABLE']),
  reason: z.string(),
  clauseId: z.string().nullable(),
  quote: z.string().nullable(),
});
export type OwnerRuleJudgement = z.infer<typeof OwnerRuleJudgement>;

// Fast pass during upload: only the fields, so the owner can start reviewing quickly
export const LeaseExtraction = z.object({
  fields: ExtractedFields,
});
export type LeaseExtraction = z.infer<typeof LeaseExtraction>;

// Background pass over the whole document with full reasoning: what needs judgement
export const LeaseAnalysis = z.object({
  conflicts: z.array(ExtractionConflict),
  concerns: z.array(ExtractionConcern),
  ownerRules: z.array(OwnerRuleJudgement).optional(),
});
export type LeaseAnalysis = z.infer<typeof LeaseAnalysis>;
