import type { Clause, Flag } from '@truelinks/shared';
import type { LeaseAnalysis } from './extractionSchema.ts';
import { verifyQuote } from './verifyQuote.ts';

const FIELD_LABELS: Record<string, string> = {
  'rent.monthly': 'Monthly rent',
  'rent.amount': 'Rent',
  'rent.annual': 'Annual rent',
  deposit: 'Deposit',
  commencementDate: 'Commencement date',
  expiryDate: 'Expiry date',
  termMonths: 'Term',
};

function formatCandidateValue(val: string): string {
  const trimmed = val.trim();
  const clean = trimmed.replace(/,/g, '');
  if (/^-?\d+(?:\.\d+)?$/.test(clean)) {
    return Number(clean).toLocaleString('en-US');
  }
  return trimmed;
}

function conflictFlags(analysis: LeaseAnalysis, clauses: Clause[]): Flag[] {
  const flags: Flag[] = [];
  // The model may report one disagreement under several fields (rent.amount and rent.monthly); the owner should see it once
  const seenConflicts = new Set<string>();

  for (const conflict of analysis.conflicts) {
    // A conflict the document doesn't support must not reach the owner as fact
    const verifiedCandidates = conflict.candidates.filter((c) => verifyQuote(clauses, c.clauseId, c.quote));

    const distinctValues = new Set(verifiedCandidates.map((c) => formatCandidateValue(c.value)));
    if (distinctValues.size < 2) {
      continue;
    }

    const conflictKey = verifiedCandidates
      .map((c) => `${c.clauseId}=${formatCandidateValue(c.value)}`)
      .sort()
      .join('|');
    if (seenConflicts.has(conflictKey)) {
      continue;
    }
    seenConflicts.add(conflictKey);

    const label = FIELD_LABELS[conflict.fieldPath] ?? conflict.fieldPath;
    const candidateParts = verifiedCandidates.map((c) => `clause ${c.clauseId} says ${formatCandidateValue(c.value)}`);

    flags.push({
      id: `VALUE_CONFLICT:${conflict.fieldPath}`,
      code: 'VALUE_CONFLICT',
      severity: 'high',
      message: `${label} conflict: ${candidateParts.join(', ')}`,
      fieldPaths: [conflict.fieldPath],
      clauseIds: [...new Set(verifiedCandidates.map((c) => c.clauseId))],
      reviewStatus: 'open',
    });
  }

  return flags;
}

function concernFlags(analysis: LeaseAnalysis): Flag[] {
  const flags: Flag[] = [];
  // Flag ids must be unique within a lease; the model may raise several concerns on one field
  const concernCounts = new Map<string, number>();

  for (const concern of analysis.concerns) {
    const count = (concernCounts.get(concern.fieldPath) ?? 0) + 1;
    concernCounts.set(concern.fieldPath, count);
    flags.push({
      id: count === 1 ? `MODEL_CONCERN:${concern.fieldPath}` : `MODEL_CONCERN:${concern.fieldPath}:${count}`,
      code: 'MODEL_CONCERN',
      severity: 'medium',
      message: concern.message,
      fieldPaths: [concern.fieldPath],
      clauseIds: concern.clauseId ? [concern.clauseId] : [],
      reviewStatus: 'open',
    });
  }

  return flags;
}

export function buildAnalysisFlags(analysis: LeaseAnalysis, clauses: Clause[]): Flag[] {
  return [...conflictFlags(analysis, clauses), ...concernFlags(analysis)];
}
