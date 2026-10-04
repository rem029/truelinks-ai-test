import { z } from 'zod';

export const PageRange = z.object({
  start: z.number().int().positive(),
  end: z.number().int().positive(),
});
export type PageRange = z.infer<typeof PageRange>;

export const Clause = z.object({
  id: z.string(),
  heading: z.string(),
  text: z.string(),
  pages: PageRange.nullable(),
});
export type Clause = z.infer<typeof Clause>;

export const TextSource = z.enum(['text', 'image']);
export type TextSource = z.infer<typeof TextSource>;

export const ClauseSplit = z.enum(['headings', 'ai', 'paragraphs']);
export type ClauseSplit = z.infer<typeof ClauseSplit>;

export const LeaseDocument = z.object({
  id: z.string(),
  conversationId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  textSource: TextSource,
  clauseSplit: ClauseSplit,
  pageCount: z.number().int().nonnegative().nullable(),
  clauses: z.array(Clause),
  createdAt: z.iso.datetime({ offset: true }),
});
export type LeaseDocument = z.infer<typeof LeaseDocument>;
