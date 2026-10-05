import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Kysely } from 'kysely';
import { createDb } from '../../db/db.ts';
import { migrateToLatest } from '../../migrations/migrate.ts';
import { seed } from '../../db/seed.ts';
import { createRepositories, type Repositories } from '../../db/repositories/index.ts';
import type { Database } from '../../db/schema.ts';
import { getIssuePhoto } from './getPhoto.ts';
import { HttpError } from '../../utils/httpError.ts';

describe('getIssuePhoto', () => {
  let db: Kysely<Database>;
  let repos: Repositories;

  beforeEach(async () => {
    db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repos = createRepositories(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('returns filePath and mimeType for a valid photo', async () => {
    const conv = await repos.conversations.create({
      id: 'conv-photo-test',
      kind: 'issue',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repos.issues.createIssue({
      id: 'issue-1',
      unitId: 'MC-B-1204',
      conversationId: conv.id,
      reporterRole: 'tenant',
      photos: [
        {
          id: 'photo-1',
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          condition: 'good',
          damages: [],
          equipment: [],
          note: '',
        },
      ],
      createdAt: new Date().toISOString(),
    });

    const result = await getIssuePhoto(conv.id, 'photo-1', {
      repositories: repos,
      uploadDir: '/var/uploads',
    });

    expect(result.filePath).toBe('/var/uploads/issues/issue-1/photo-1.jpg');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('throws 404 when issue does not exist', async () => {
    await expect(
      getIssuePhoto('missing-conv', 'photo-1', {
        repositories: repos,
        uploadDir: '/var/uploads',
      })
    ).rejects.toThrow(HttpError);
  });

  it('throws 404 when photo does not exist in issue', async () => {
    const conv = await repos.conversations.create({
      id: 'conv-photo-test-2',
      kind: 'issue',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repos.issues.createIssue({
      id: 'issue-2',
      unitId: 'MC-B-1204',
      conversationId: conv.id,
      reporterRole: 'tenant',
      photos: [],
      createdAt: new Date().toISOString(),
    });

    await expect(
      getIssuePhoto(conv.id, 'non-existent', {
        repositories: repos,
        uploadDir: '/var/uploads',
      })
    ).rejects.toThrow(HttpError);
  });
});
