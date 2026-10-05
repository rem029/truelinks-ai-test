import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Kysely } from 'kysely';
import { createDb } from '../db/db.ts';
import { migrateToLatest } from '../../migrations/migrate.ts';
import { seed } from '../db/seed.ts';
import { createRepositories, type Repositories } from '../db/repositories/index.ts';
import type { Database } from '../db/schema.ts';
import { createConversation } from './createConversation.ts';
import { getConversation } from './getConversation.ts';
import { HttpError } from '../../utils/httpError.ts';

describe('getConversation', () => {
  let db: Kysely<Database>;
  let repositories: Repositories;

  beforeEach(async () => {
    db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repositories = createRepositories(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('throws 404 for non-existent conversation', async () => {
    await expect(getConversation('missing-id', repositories)).rejects.toThrow(HttpError);
  });

  it('returns conversation with null lease and null review when no lease exists', async () => {
    const conv = await createConversation({ kind: 'lease' }, repositories);
    const details = await getConversation(conv.id, repositories);

    expect(details.conversation.id).toBe(conv.id);
    expect(details.lease).toBeNull();
    expect(details.review).toBeNull();
    expect(details.documents).toHaveLength(0);
    expect(details.messages).toHaveLength(0);
  });
});
