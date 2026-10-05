import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Flag, Lease, LeaseDocument, LeaseRecord } from '@truelinks/shared';
import { listFields } from '../leaseFields.ts';
import { LeaseAnalysis } from './extractionSchema.ts';
import { buildAnalysisFlags } from './analysisFlags.ts';
import { formatClausesForModel, type ExtractLeaseContext } from './extractLease.ts';
import { reevaluateLease } from '../review/reevaluateLease.ts';
import { addReviewMessage } from '../review/reviewMessage.ts';

const PROMPT_PATH = resolve(import.meta.dirname, '../../agents/prompts/leaseAnalysis.md');
const LEASE_ANALYSIS_PROMPT = readFileSync(PROMPT_PATH, 'utf-8');

function formatExtractedValues(record: LeaseRecord): string {
  return listFields(record)
    .filter(({ field }) => field.value !== null)
    .map(({ fieldPath, field }) => {
      const clause = field.source?.type === 'document' ? ` (clause ${field.source.clauseId})` : '';
      return `${fieldPath} = ${JSON.stringify(field.value)}${clause}`;
    })
    .join('\n');
}

// Runs after the upload has answered, so it never throws to a caller: a failure is recorded on the lease for the owner to see
export async function analyzeLease(lease: Lease, document: LeaseDocument, context: ExtractLeaseContext): Promise<Lease> {
  const startTime = Date.now();
  const { repositories, modelProvider } = context;

  let analysisFlags: Flag[];
  let analysisStatus: 'done' | 'failed';
  try {
    const result = await modelProvider.complete({
      purpose: 'lease-analysis',
      messages: [
        { role: 'system', content: LEASE_ANALYSIS_PROMPT },
        {
          role: 'user',
          content: `Document: ${document.filename}\n\nExtracted values:\n${formatExtractedValues(lease.record)}\n\nClauses:\n${formatClausesForModel(document)}`,
        },
      ],
      responseSchema: LeaseAnalysis,
    });
    if (!result.output) {
      throw new Error('Model returned no analysis');
    }
    analysisFlags = buildAnalysisFlags(result.output, document.clauses);
    analysisStatus = 'done';
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.log(`lease analyze lease=${lease.id} failed reason=${reason}`);
    analysisFlags = [
      {
        id: 'ANALYSIS_FAILED',
        code: 'ANALYSIS_FAILED',
        severity: 'medium',
        message: 'Full lease review failed; conflicting values and vague terms were not checked',
        fieldPaths: [],
        clauseIds: [],
        reviewStatus: 'open',
      },
    ];
    analysisStatus = 'failed';
  }

  // Re-read: the owner may have changed the lease while the analysis ran
  const current = await repositories.leases.get(lease.id);
  if (!current) {
    throw new Error(`Lease ${lease.id} disappeared during analysis`);
  }
  const existingIds = new Set(current.flags.map((f) => f.id));
  const newFlags = analysisFlags.filter((f) => !existingIds.has(f.id));
  const updated = await repositories.leases.update({
    ...current,
    flags: [...current.flags, ...newFlags],
    analysisStatus,
    updatedAt: new Date().toISOString(),
  });

  try {
    const { lease: reevaluated, unitMatch } = await reevaluateLease(updated, repositories);
    let messageText: string;
    if (analysisStatus === 'done') {
      if (newFlags.length > 0) {
        const flagMsgs = newFlags.map((f) => f.message).join('; ');
        messageText = `Full review finished: ${flagMsgs}`;
      } else {
        messageText = 'Full review finished: nothing new.';
      }
    } else {
      messageText = 'Full review failed; conflicting values and vague terms were not checked.';
    }
    await addReviewMessage(reevaluated, unitMatch, messageText, repositories);
  } catch (err) {
    console.error(`lease analyze review message lease=${lease.id} failed`, err);
  }

  console.log(
    `lease analyze lease=${lease.id} status=${analysisStatus} flags=${analysisFlags.length} ms=${Date.now() - startTime}`
  );
  return updated;
}
