import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Kysely } from 'kysely';
import { createDb } from '../db/db.ts';
import { migrateToLatest } from '../../migrations/migrate.ts';
import { seed } from '../db/seed.ts';
import { createRepositories, type Repositories } from '../db/repositories/index.ts';
import type { Database } from '../db/schema.ts';
import { createStubProvider } from '../agents/modelProvider/stubProvider.ts';
import type { ModelProvider } from '../agents/modelProvider/types.ts';
import { REPO_ROOT } from '../../env.ts';
import { reportIssue } from './reportIssue.ts';
import { getConversation } from '../conversations/getConversation.ts';
import { listConversations } from '../conversations/listConversations.ts';
import { HttpError } from '../../utils/httpError.ts';

describe('reportIssue service', () => {
  let db: Kysely<Database>;
  let repos: Repositories;
  let uploadDir: string;
  let stubProvider: ModelProvider;

  beforeEach(async () => {
    uploadDir = mkdtempSync(join(tmpdir(), 'truelinks-issue-test-'));
    db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repos = createRepositories(db);
    stubProvider = createStubProvider();
  });

  afterEach(async () => {
    await db.destroy();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  it('happy path with issue-01 photos: generates condition card, messages, files and conversation state', async () => {
    const conv = await repos.conversations.create({
      id: 'conv-issue-01',
      kind: 'issue',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const photo1Path = resolve(REPO_ROOT, 'data/sample-photos/issue-01-ac-leak-1.jpg');
    const photo2Path = resolve(REPO_ROOT, 'data/sample-photos/issue-01-ac-leak-2.jpg');
    const photo1Buf = readFileSync(photo1Path);
    const photo2Buf = readFileSync(photo2Path);

    const result = await reportIssue(
      {
        conversationId: conv.id,
        reporterRole: 'tenant',
        note: 'AC is leaking water on the floor',
        photos: [
          { buffer: photo1Buf, originalName: 'issue-01-ac-leak-1.jpg', mimeType: 'image/jpeg' },
          { buffer: photo2Buf, originalName: 'issue-01-ac-leak-2.jpg', mimeType: 'image/jpeg' },
        ],
      },
      { repositories: repos, uploadDir, modelProvider: stubProvider }
    );

    expect(result.issue).toBeDefined();
    expect(result.issue.unitId).toBe('MC-B-1204');
    expect(result.issue.reporterRole).toBe('tenant');
    expect(result.issue.note).toBe('AC is leaking water on the floor');
    expect(result.issue.photos).toHaveLength(2);

    expect(result.messages).toHaveLength(2);
    const [userMsg, assistantMsg] = result.messages;
    expect(userMsg?.role).toBe('user');
    expect(userMsg?.text).toBe('AC is leaking water on the floor');
    expect(userMsg?.attachments).toHaveLength(2);
    expect(userMsg?.attachments[0]?.filename).toBe('issue-01-ac-leak-1.jpg');

    expect(assistantMsg?.role).toBe('assistant');
    expect(assistantMsg?.text).toContain('Looked at 2 photos: 1 damaged, 1 worn.');
    expect(assistantMsg?.text).toContain('Drafting a work order comes next.');
    expect(assistantMsg?.cards).toHaveLength(1);
    const conditionCard = assistantMsg?.cards[0];
    expect(conditionCard?.type).toBe('condition');
    if (conditionCard?.type === 'condition') {
      expect(conditionCard.photos).toHaveLength(2);
      expect(conditionCard.photos[0]?.condition).toBe('damaged');
      expect(conditionCard.photos[1]?.condition).toBe('worn');
    }

    // Verify files on disk
    for (const p of result.issue.photos) {
      const diskPath = resolve(uploadDir, 'issues', result.issue.id, `${p.id}.jpg`);
      expect(existsSync(diskPath)).toBe(true);
    }

    // Verify getConversation returns issue
    const details = await getConversation(conv.id, repos);
    expect(details.issue).toBeDefined();
    expect(details.issue?.id).toBe(result.issue.id);

    // Verify listConversations includes the issue conversation with photoCount
    const summaries = await listConversations({}, repos);
    const issueSummary = summaries.find((s) => s.id === conv.id);
    expect(issueSummary).toBeDefined();
    expect(issueSummary?.kind).toBe('issue');
    expect(issueSummary?.photoCount).toBe(2);
    expect(issueSummary?.filename).toBeNull();
    expect(issueSummary?.leaseStatus).toBeNull();
  });

  it('undeterminable issue-05: asks for clearer photo', async () => {
    const conv = await repos.conversations.create({
      id: 'conv-issue-05',
      kind: 'issue',
      unitId: 'MC-A-0301',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const photoPath = resolve(REPO_ROOT, 'data/sample-photos/issue-05-unclear-1.jpg');
    const photoBuf = readFileSync(photoPath);

    const result = await reportIssue(
      {
        conversationId: conv.id,
        reporterRole: 'inspector',
        photos: [{ buffer: photoBuf, originalName: 'issue-05-unclear-1.jpg', mimeType: 'image/jpeg' }],
      },
      { repositories: repos, uploadDir, modelProvider: stubProvider }
    );

    const assistantMsg = result.messages[1];
    expect(assistantMsg?.text).toBe("I can't judge the condition from these photos; please send a clearer one.");
    expect(userMsgText(result.messages[0]?.text)).toBe('Reported an issue');
  });

  it('no-damage issue-04: reports "No damage seen."', async () => {
    const conv = await repos.conversations.create({
      id: 'conv-issue-04',
      kind: 'issue',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const photo1 = readFileSync(resolve(REPO_ROOT, 'data/sample-photos/issue-04-move-in-ok-1.jpg'));
    const photo2 = readFileSync(resolve(REPO_ROOT, 'data/sample-photos/issue-04-move-in-ok-2.jpg'));

    const result = await reportIssue(
      {
        conversationId: conv.id,
        reporterRole: 'tenant',
        photos: [
          { buffer: photo1, originalName: 'issue-04-move-in-ok-1.jpg', mimeType: 'image/jpeg' },
          { buffer: photo2, originalName: 'issue-04-move-in-ok-2.jpg', mimeType: 'image/jpeg' },
        ],
      },
      { repositories: repos, uploadDir, modelProvider: stubProvider }
    );

    const assistantMsg = result.messages[1];
    expect(assistantMsg?.text).toBe('Looked at 2 photos: 2 new. No damage seen.');
    expect(assistantMsg?.text).not.toContain('Drafting a work order');
  });

  it('rejects second issue report on the same conversation with 409', async () => {
    const conv = await repos.conversations.create({
      id: 'conv-issue-dup',
      kind: 'issue',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const photo = readFileSync(resolve(REPO_ROOT, 'data/sample-photos/issue-04-move-in-ok-1.jpg'));

    await reportIssue(
      {
        conversationId: conv.id,
        reporterRole: 'tenant',
        photos: [{ buffer: photo, originalName: 'issue-04-move-in-ok-1.jpg', mimeType: 'image/jpeg' }],
      },
      { repositories: repos, uploadDir, modelProvider: stubProvider }
    );

    await expect(
      reportIssue(
        {
          conversationId: conv.id,
          reporterRole: 'tenant',
          photos: [{ buffer: photo, originalName: 'issue-04-move-in-ok-1.jpg', mimeType: 'image/jpeg' }],
        },
        { repositories: repos, uploadDir, modelProvider: stubProvider }
      )
    ).rejects.toThrow(HttpError);

    try {
      await reportIssue(
        {
          conversationId: conv.id,
          reporterRole: 'tenant',
          photos: [{ buffer: photo, originalName: 'issue-04-move-in-ok-1.jpg', mimeType: 'image/jpeg' }],
        },
        { repositories: repos, uploadDir, modelProvider: stubProvider }
      );
    } catch (err) {
      expect((err as HttpError).status).toBe(409);
    }
  });

  it('rejects wrong kind, missing unit, no photos, or bad mime with 400', async () => {
    // 1. Wrong kind (lease)
    const leaseConv = await repos.conversations.create({
      id: 'conv-lease',
      kind: 'lease',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const photo = readFileSync(resolve(REPO_ROOT, 'data/sample-photos/issue-04-move-in-ok-1.jpg'));

    await expect(
      reportIssue(
        {
          conversationId: leaseConv.id,
          reporterRole: 'tenant',
          photos: [{ buffer: photo, originalName: 'photo.jpg', mimeType: 'image/jpeg' }],
        },
        { repositories: repos, uploadDir, modelProvider: stubProvider }
      )
    ).rejects.toMatchObject({ status: 400 });

    // 2. Issue conversation without unitId
    const noUnitConv = await repos.conversations.create({
      id: 'conv-no-unit',
      kind: 'issue',
      unitId: null,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      reportIssue(
        {
          conversationId: noUnitConv.id,
          reporterRole: 'tenant',
          photos: [{ buffer: photo, originalName: 'photo.jpg', mimeType: 'image/jpeg' }],
        },
        { repositories: repos, uploadDir, modelProvider: stubProvider }
      )
    ).rejects.toMatchObject({ status: 400 });

    // 3. No photos
    const validConv = await repos.conversations.create({
      id: 'conv-valid',
      kind: 'issue',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      reportIssue(
        {
          conversationId: validConv.id,
          reporterRole: 'tenant',
          photos: [],
        },
        { repositories: repos, uploadDir, modelProvider: stubProvider }
      )
    ).rejects.toMatchObject({ status: 400 });

    // 4. Bad mime type
    await expect(
      reportIssue(
        {
          conversationId: validConv.id,
          reporterRole: 'tenant',
          photos: [{ buffer: Buffer.from('hello'), originalName: 'doc.pdf', mimeType: 'application/pdf' }],
        },
        { repositories: repos, uploadDir, modelProvider: stubProvider }
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('provider failure returns 502 with reason and saves nothing', async () => {
    const conv = await repos.conversations.create({
      id: 'conv-fail-502',
      kind: 'issue',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const failingProvider: ModelProvider = {
      name: 'stub',
      complete: async () => {
        throw new Error('OpenRouter upstream timeout 504');
      },
    };

    const photo = readFileSync(resolve(REPO_ROOT, 'data/sample-photos/issue-04-move-in-ok-1.jpg'));

    try {
      await reportIssue(
        {
          conversationId: conv.id,
          reporterRole: 'tenant',
          photos: [{ buffer: photo, originalName: 'photo.jpg', mimeType: 'image/jpeg' }],
        },
        { repositories: repos, uploadDir, modelProvider: failingProvider }
      );
      expect.fail('Should have thrown 502');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(502);
      expect((httpErr.details as { reason: string }).reason).toContain('OpenRouter upstream timeout 504');
    }

    // Verify nothing saved
    const savedIssue = await repos.issues.getByConversation(conv.id);
    expect(savedIssue).toBeNull();
    const messages = await repos.conversations.listMessages(conv.id);
    expect(messages).toHaveLength(0);
    const files = existsSync(resolve(uploadDir, 'issues')) ? [] : [];
    expect(files).toHaveLength(0);
  });
});

function userMsgText(text: string | undefined): string {
  return text ?? '';
}
