import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Clause } from '@truelinks/shared';
import type { ModelProvider } from '../../agents/modelProvider/types.ts';
import { buildClauses, type DetectedHeading, type DocumentLine } from './splitClauses.ts';

const PROMPT_PATH = resolve(import.meta.dirname, '../../agents/prompts/leaseClauseHeadings.md');
const LEASE_CLAUSE_HEADINGS_PROMPT = readFileSync(PROMPT_PATH, 'utf-8');

export const HeadingItemSchema = z.object({
  line: z.number().int().nonnegative(),
  id: z.string().min(1),
});

export const HeadingsResponseSchema = z.object({
  headings: z.array(HeadingItemSchema),
});

function extractHeadingFromLine(line: string, id: string): string {
  const trimmed = line.trim();
  const numberedMatch = trimmed.match(/^(\d+)\.\s*(.+)$/);
  if (numberedMatch && numberedMatch[2]) {
    const afterNumber = numberedMatch[2].trim();
    const dotMatch = afterNumber.match(/^(.*?)\.\s+(.*)$/);
    if (dotMatch && dotMatch[1]) {
      const headingCandidate = dotMatch[1].trim();
      if (headingCandidate.length > 0 && headingCandidate.length <= 80) {
        return headingCandidate;
      }
    }
    if (afterNumber.length <= 80) {
      return afterNumber;
    }
    return id;
  }

  if (trimmed.length <= 80) {
    return trimmed;
  }
  return id;
}

export async function detectHeadingsWithModel(
  lines: DocumentLine[],
  modelProvider: ModelProvider
): Promise<Clause[] | null> {
  const numberedLines = lines
    .map((item, idx) => ({ idx, text: item.line.trim() }))
    .filter((item) => item.text.length > 0)
    .map((item) => `${item.idx}: ${item.text.slice(0, 120)}`)
    .join('\n');

  try {
    const result = await modelProvider.complete({
      purpose: 'lease-clause-headings',
      messages: [
        { role: 'system', content: LEASE_CLAUSE_HEADINGS_PROMPT },
        { role: 'user', content: numberedLines },
      ],
      responseSchema: HeadingsResponseSchema,
    });

    const headings = result.output?.headings;
    if (!headings || headings.length === 0) {
      return null;
    }

    if (headings.length > 200) {
      console.log('detectHeadings rejected: model returned > 200 headings');
      return null;
    }

    let prevLine = -1;
    const seenIds = new Set<string>();

    for (const h of headings) {
      if (h.line <= prevLine) {
        console.log(`detectHeadings rejected: line ${h.line} is not strictly ascending (prev: ${prevLine})`);
        return null;
      }
      if (h.line >= lines.length) {
        console.log(`detectHeadings rejected: line ${h.line} is out of range (max: ${lines.length - 1})`);
        return null;
      }
      const lineText = lines[h.line]?.line.trim();
      if (!lineText) {
        console.log(`detectHeadings rejected: line ${h.line} is empty`);
        return null;
      }
      if (seenIds.has(h.id)) {
        console.log(`detectHeadings rejected: duplicate clause id '${h.id}'`);
        return null;
      }

      seenIds.add(h.id);
      prevLine = h.line;
    }

    const detected: DetectedHeading[] = headings.map((h) => {
      const lineItem = lines[h.line]!;
      return {
        id: h.id,
        heading: extractHeadingFromLine(lineItem.line, h.id),
        lineIndex: h.line,
        page: lineItem.page,
      };
    });

    return buildClauses(lines, detected, { isAi: true });
  } catch (err) {
    // Failed model call deliberately degrades to rules/paragraph split; clauseSplit informs human review.
    const message = err instanceof Error ? err.message : String(err);
    console.log(`detectHeadings model error: ${message}`);
    return null;
  }
}
