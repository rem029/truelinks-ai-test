import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Lease, LeaseDocument } from '@truelinks/shared';
import type { Repositories } from '../../../db/repositories/index.ts';
import type { ModelProvider } from '../../agents/modelProvider/types.ts';
import { HttpError } from '../../../utils/httpError.ts';
import { evaluateLease } from '../evaluateLease.ts';
import { listFields } from '../leaseFields.ts';
import { LeaseExtraction } from './extractionSchema.ts';
import { buildLeaseRecord } from './buildLeaseRecord.ts';

const PROMPT_PATH = resolve(import.meta.dirname, '../../agents/prompts/leaseExtraction.md');
const LEASE_EXTRACTION_PROMPT = readFileSync(PROMPT_PATH, 'utf-8');

export interface ExtractLeaseContext {
  repositories: Repositories;
  modelProvider: ModelProvider;
}

export function formatClausesForModel(document: LeaseDocument): string {
  return document.clauses.map((clause) => `[${clause.id}] ${clause.heading}\n${clause.text}`).join('\n\n');
}

// Fast pass while the owner waits on the upload; conflicts and judgement come later from analyzeLease
export async function extractLease(document: LeaseDocument, context: ExtractLeaseContext): Promise<Lease> {
  const startTime = Date.now();
  const { repositories, modelProvider } = context;

  const conversation = await repositories.conversations.get(document.conversationId);
  if (!conversation) {
    throw new HttpError(404, `Conversation ${document.conversationId} not found`);
  }

  let extraction: LeaseExtraction | null;
  try {
    const result = await modelProvider.complete({
      purpose: 'lease-extraction',
      messages: [
        { role: 'system', content: LEASE_EXTRACTION_PROMPT },
        { role: 'user', content: `Document: ${document.filename}\n\n${formatClausesForModel(document)}` },
      ],
      responseSchema: LeaseExtraction,
      // Copying fields out needs little thinking, and code checks every quote; this halves the wait
      reasoningEffort: 'low',
      modelTier: 'fast',
    });
    extraction = result.output;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new HttpError(502, 'Lease extraction failed; the document is saved, try again', { reason });
  }
  if (!extraction) {
    throw new HttpError(502, 'Lease extraction returned no record; the document is saved, try again');
  }

  const { record, flags: extractionFlags } = buildLeaseRecord(extraction, document.clauses);
  const evaluation = await evaluateLease(
    {
      record,
      pageUnitId: conversation.unitId,
      document: { textSource: document.textSource, clauseSplit: document.clauseSplit },
    },
    repositories
  );

  const now = new Date().toISOString();
  const lease: Lease = {
    id: randomUUID(),
    conversationId: conversation.id,
    unitId: evaluation.unitMatch.status === 'matched' ? evaluation.unitMatch.unit.unitId : null,
    record,
    flags: [...evaluation.flags, ...extractionFlags],
    ruleResults: evaluation.ruleResults,
    rulesetVersion: evaluation.rulesetVersion,
    status: 'draft',
    analysisStatus: 'pending',
    overrideReason: null,
    confirmedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await repositories.leases.create(lease);

  const fields = listFields(record);
  const found = fields.filter(({ field }) => field.value !== null).length;
  const unverified = fields.filter(({ field }) => field.source?.type === 'document' && !field.source.verified).length;
  console.log(
    `lease extract conversation=${conversation.id} document=${document.id} found=${found}/${fields.length} unverified=${unverified} flags=${lease.flags.length} ms=${Date.now() - startTime}`
  );

  return lease;
}
