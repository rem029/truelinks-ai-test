import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from '../../env.ts';
import type { Repositories } from '../../db/repositories/index.ts';
import { createStubProvider } from '../agents/modelProvider/stubProvider.ts';
import { createConversation } from '../conversations/createConversation.ts';
import { ingestLease } from './ingest/ingestLease.ts';
import { extractLease } from './extract/extractLease.ts';
import { analyzeLease } from './extract/analyzeLease.ts';
import { addFirstReviewMessage } from './review/reviewMessage.ts';
import { applyCardAction } from './review/applyCardAction.ts';

const CURRENT_LEASES_DIR = resolve(REPO_ROOT, 'data/current-leases');
const IMPORT_REASON = "Existing tenancy imported from the owner's records";

// Occupied units come with the lease in effect (data/current-leases/current-lease-<unitId>.pdf).
// Each goes through the same pipeline as an upload, on the stub model so seeding is free and repeatable,
// and is confirmed by the seed itself: the owner's own records are the human confirmation here.
export async function seedCurrentLeases(repositories: Repositories, uploadDir: string): Promise<number> {
  const modelProvider = createStubProvider();
  const files = readdirSync(CURRENT_LEASES_DIR).filter((name) => name.endsWith('.pdf'));
  let seeded = 0;

  for (const filename of files) {
    const unitId = /^current-lease-(.+)\.pdf$/.exec(filename)?.[1];
    if (!unitId) {
      throw new Error(`Current lease ${filename} must be named current-lease-<unitId>.pdf`);
    }
    if (!(await repositories.units.get(unitId))) {
      throw new Error(`Current lease ${filename} names unit ${unitId}, which is not in data/units.json`);
    }
    const existing = await repositories.leases.listByUnit(unitId);
    if (existing.some((lease) => lease.status === 'confirmed')) {
      continue;
    }

    const conversation = await createConversation({ kind: 'lease', unitId }, repositories);
    const { document } = await ingestLease(
      {
        conversationId: conversation.id,
        file: { buffer: readFileSync(resolve(CURRENT_LEASES_DIR, filename)), originalName: filename, mimeType: 'application/pdf' },
      },
      { repositories, uploadDir, modelProvider }
    );
    const lease = await extractLease(document, { repositories, modelProvider });
    await addFirstReviewMessage(lease, filename, repositories);
    await analyzeLease(lease, document, { repositories, modelProvider });

    const context = { repositories };
    const { lease: reviewed } = await applyCardAction(conversation.id, { type: 'acceptAll' }, context);
    for (const flag of reviewed.flags.filter((f) => f.reviewStatus === 'open')) {
      await applyCardAction(conversation.id, { type: 'accept', cardId: `flag:${flag.id}` }, context);
    }
    await applyCardAction(conversation.id, { type: 'confirm', conversationId: conversation.id, overrideReason: IMPORT_REASON }, context);
    seeded += 1;
  }

  console.log(`Seeded ${seeded} current leases`);
  return seeded;
}
