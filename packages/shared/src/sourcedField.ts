import { z } from 'zod';

export const SourceDocument = z.object({
  type: z.literal('document'),
  clauseId: z.string(),
  quote: z.string(),
  verified: z.boolean(),
});
export type SourceDocument = z.infer<typeof SourceDocument>;

export const SourceUser = z.object({
  type: z.literal('user'),
  messageId: z.string(),
});
export type SourceUser = z.infer<typeof SourceUser>;

export const Source = z.discriminatedUnion('type', [SourceDocument, SourceUser]);
export type Source = z.infer<typeof Source>;

export const ReviewStatus = z.enum(['pending', 'accepted', 'rejected', 'edited']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export function createReviewSchema<T extends z.ZodTypeAny>(valueSchema?: T) {
  return z.object({
    status: ReviewStatus,
    original: valueSchema ? valueSchema.optional() : z.unknown().optional(),
    reviewedAt: z.iso.datetime({ offset: true }).optional(),
  });
}

export const Review = createReviewSchema();
export type Review = z.infer<typeof Review>;

export function sourcedField<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    source: Source.nullable(),
    confidence: z.number().min(0).max(1),
    review: createReviewSchema(valueSchema),
  });
}

export type SourcedField<T extends z.ZodTypeAny = z.ZodTypeAny> = z.infer<ReturnType<typeof sourcedField<T>>>;
