import { z } from 'zod';
import { Severity } from './severity.js';

export const FlagReviewStatus = z.enum(['open', 'accepted', 'dismissed']);
export type FlagReviewStatus = z.infer<typeof FlagReviewStatus>;

export const Flag = z.object({
  id: z.string(),
  code: z.string(),
  severity: Severity,
  message: z.string(),
  fieldPaths: z.array(z.string()),
  clauseIds: z.array(z.string()),
  reviewStatus: FlagReviewStatus,
});
export type Flag = z.infer<typeof Flag>;
