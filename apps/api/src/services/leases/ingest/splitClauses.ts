import type { Clause, PageRange } from '@truelinks/shared';

export interface DocumentLine {
  line: string;
  page: number | null;
}

export interface DetectedHeading {
  id: string;
  heading: string;
  lineIndex: number;
  page: number | null;
}

export interface SplitClausesResult {
  clauses: Clause[];
  usedFallback: boolean;
}

function collapseLines(items: DocumentLine[]): string {
  let result = '';
  for (const item of items) {
    const trimmed = item.line.trim();
    if (!trimmed) continue;
    if (!result) {
      result = trimmed;
    } else if (result.endsWith('-')) {
      // PDF line breaks split hyphenated identifiers (e.g. MC-B-1204 -> MC-\nB-1204);
      // joining without space preserves the original identifier.
      result += trimmed;
    } else {
      result += ` ${trimmed}`;
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

function getPageRange(items: DocumentLine[]): PageRange | null {
  const pages = items.map((it) => it.page).filter((p): p is number => p !== null);
  if (pages.length === 0) {
    return null;
  }
  return {
    start: Math.min(...pages),
    end: Math.max(...pages),
  };
}

export function toLines(pages: Array<{ page: number | null; text: string }>): DocumentLine[] {
  const lines: DocumentLine[] = [];
  for (const p of pages) {
    const split = p.text.split(/\r?\n/);
    for (const line of split) {
      lines.push({ line, page: p.page });
    }
  }
  return lines;
}

export function findHeadings(lines: DocumentLine[]): DetectedHeading[] {
  let prevNumber = 0;
  let hasSeenFirstNonEmptyLine = false;
  const slugCounts = new Map<string, number>();
  const detectedHeadings: DetectedHeading[] = [];

  for (const [i, item] of lines.entries()) {
    const trimmed = item.line.trim();
    if (!trimmed) continue;

    // Document titles (e.g. RESIDENTIAL LEASE AGREEMENT) are all-caps headers;
    // exempting the first non-empty line ensures it starts the preamble rather than an empty section.
    if (!hasSeenFirstNonEmptyLine) {
      hasSeenFirstNonEmptyLine = true;
      continue;
    }

    // Numbered heading: ^(\d+)\.\s+(.+)$ with strict sequential numbering starting at 1
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    const numStr = numberedMatch?.[1];
    const headingCandidate = numberedMatch?.[2];
    if (numStr && headingCandidate) {
      const num = parseInt(numStr, 10);
      const headingPart = headingCandidate.trim();
      if (num === prevNumber + 1 && headingPart.length <= 80 && /^[A-Z]/.test(headingPart)) {
        prevNumber = num;
        detectedHeadings.push({
          id: String(num),
          heading: headingPart,
          lineIndex: i,
          page: item.page,
        });
        continue;
      }
    }

    // Section heading: short line (<= 40 chars), all uppercase letters/spaces, at least one letter
    if (trimmed.length <= 40 && /^[A-Z\s]+$/.test(trimmed) && /[A-Z]/.test(trimmed)) {
      const baseSlug = trimmed.toLowerCase().replace(/\s+/g, '-');
      const count = (slugCounts.get(baseSlug) ?? 0) + 1;
      slugCounts.set(baseSlug, count);
      const id = count === 1 ? baseSlug : `${baseSlug}-${count}`;
      detectedHeadings.push({
        id,
        heading: trimmed,
        lineIndex: i,
        page: item.page,
      });
      continue;
    }
  }

  return detectedHeadings;
}

export function buildClauses(
  lines: DocumentLine[],
  headings: DetectedHeading[],
  options?: { isAi?: boolean }
): Clause[] {
  const clauses: Clause[] = [];

  // Preamble: text before the first detected heading
  const firstHeading = headings[0];
  if (firstHeading && firstHeading.lineIndex > 0) {
    const preambleLines = lines.slice(0, firstHeading.lineIndex).filter((it) => it.line.trim().length > 0);
    if (preambleLines.length > 0) {
      clauses.push({
        id: 'preamble',
        heading: 'Preamble',
        text: collapseLines(preambleLines),
        pages: getPageRange(preambleLines),
      });
    }
  }

  // Heading-based clauses
  for (let h = 0; h < headings.length; h++) {
    const current = headings[h];
    if (!current) continue;
    const nextHeading = headings[h + 1];
    const nextLineIndex = nextHeading ? nextHeading.lineIndex : lines.length;

    // For AI-detected headings, heading lines often include body text inline
    // (e.g. "1. Term. The term of this Lease is..."); including the heading line
    // in bodyLines preserves quotes starting from the first sentence.
    const bodyLines = options?.isAi
      ? lines.slice(current.lineIndex, nextLineIndex)
      : lines.slice(current.lineIndex + 1, nextLineIndex);
    const allClauseLines = lines.slice(current.lineIndex, nextLineIndex).filter((it) => it.line.trim().length > 0);

    clauses.push({
      id: current.id,
      heading: current.heading,
      text: collapseLines(bodyLines),
      pages: getPageRange(allClauseLines),
    });
  }

  return clauses;
}

export function paragraphClauses(lines: DocumentLine[]): Clause[] {
  const hasBlankLines = lines.some((it) => it.line.trim().length === 0);
  const paragraphs: DocumentLine[][] = [];

  if (hasBlankLines) {
    let current: DocumentLine[] = [];
    for (const item of lines) {
      if (!item.line.trim()) {
        if (current.length > 0) {
          paragraphs.push(current);
          current = [];
        }
      } else {
        current.push(item);
      }
    }
    if (current.length > 0) {
      paragraphs.push(current);
    }
  } else {
    // Group lines by page when no blank lines exist
    let currentPage: number | null | undefined = undefined;
    let current: DocumentLine[] = [];
    for (const item of lines) {
      if (item.line.trim().length === 0) continue;
      if (currentPage !== undefined && item.page !== currentPage) {
        if (current.length > 0) {
          paragraphs.push(current);
          current = [];
        }
      }
      currentPage = item.page;
      current.push(item);
    }
    if (current.length > 0) {
      paragraphs.push(current);
    }
  }

  return paragraphs.map((para, idx) => ({
    id: `p${idx + 1}`,
    heading: `Paragraph ${idx + 1}`,
    text: collapseLines(para),
    pages: getPageRange(para),
  }));
}

export function splitClauses(pages: Array<{ page: number | null; text: string }>): SplitClausesResult {
  const lines = toLines(pages);
  const headings = findHeadings(lines);

  if (headings.length === 0) {
    return {
      clauses: paragraphClauses(lines),
      usedFallback: true,
    };
  }

  return {
    clauses: buildClauses(lines, headings),
    usedFallback: false,
  };
}
