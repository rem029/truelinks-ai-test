import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import {
  HealthResponse,
  Unit,
  Conversation,
  Lease,
  LeaseDocument,
  Message,
  ConversationDetails,
  ConversationReview,
  ConversationSummary,
  ReportIssueResponse,
} from '@truelinks/shared';
import { createApp } from './app.ts';
import { createDb } from './services/db/db.ts';
import { migrateToLatest } from './migrations/migrate.ts';
import { seed } from './services/db/seed.ts';
import { createRepositories, type Repositories } from './services/db/repositories/index.ts';
import { createStubProvider } from './services/agents/modelProvider/stubProvider.ts';

describe('API', () => {
  let server: Server;
  let baseUrl: string;
  let uploadDir: string;
  let repositories: Repositories;

  beforeAll(async () => {
    uploadDir = mkdtempSync(join(tmpdir(), 'truelinks-uploads-test-'));
    const db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repositories = createRepositories(db);
    const modelProvider = createStubProvider();

    const app = createApp({ repositories, modelProvider, uploadDir });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    rmSync(uploadDir, { recursive: true, force: true });
  });

  it('GET /api/health returns 200 {status:"ok", modelProvider:"stub"} validating with shared schema', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    const validated = HealthResponse.parse(json);
    expect(validated).toEqual({ status: 'ok', modelProvider: 'stub' });
  });

  it('GET /api/units returns 5 units with MC-B-1205 occupied', async () => {
    const res = await fetch(`${baseUrl}/api/units`);
    expect(res.status).toBe(200);
    const json = await res.json();
    const units = z.array(Unit).parse(json);
    expect(units).toHaveLength(5);
    const unit1205 = units.find((u) => u.unitId === 'MC-B-1205');
    expect(unit1205).toBeDefined();
    expect(unit1205?.status).toBe('occupied');
  });

  it('GET /api/nope returns 404 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/nope`);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: 'Not found' });
  });

  it('POST /api/conversations creates a lease conversation with valid unitId', async () => {
    const res = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'lease', unitId: 'MC-B-1204' }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    const conversation = Conversation.parse(json);
    expect(conversation.kind).toBe('lease');
    expect(conversation.unitId).toBe('MC-B-1204');
    expect(conversation.status).toBe('open');

    // GET without lease returns review: null
    const getRes = await fetch(`${baseUrl}/api/conversations/${conversation.id}`);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    const details = ConversationDetails.parse(getJson);
    expect(details.lease).toBeNull();
    expect(details.review).toBeNull();
  });

  it('GET /api/conversations?kind=lease omits empty conversations without documents', async () => {
    const res = await fetch(`${baseUrl}/api/conversations?kind=lease`);
    expect(res.status).toBe(200);
    const json = await res.json();
    const summaries = z.array(ConversationSummary).parse(json);
    expect(summaries).toEqual([]);
  });

  it('POST /api/conversations fails with 400 when unitId does not exist', async () => {
    const res = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'lease', unitId: 'NON_EXISTENT_UNIT' }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('Unit NON_EXISTENT_UNIT not found');
  });

  it('POST /api/conversations/:id/lease-document ingests PDF and exposes via GET file and conversation', async () => {
    // 1. Create a lease conversation
    const convRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'lease', unitId: 'MC-B-1204' }),
    });
    const conv = Conversation.parse(await convRes.json());

    // 2. Upload lease-01 PDF
    const pdfPath = resolve(import.meta.dirname, '../../../data/sample-leases/lease-01-clean-MC-B-1204.pdf');
    const pdfBuffer = readFileSync(pdfPath);

    const formData = new FormData();
    formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'lease-01-clean-MC-B-1204.pdf');

    const uploadRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/lease-document`, {
      method: 'POST',
      body: formData,
    });
    expect(uploadRes.status).toBe(201);
    const uploadJson = (await uploadRes.json()) as { document: unknown; message: unknown; lease: unknown };
    const doc = LeaseDocument.parse(uploadJson.document);
    const msg = Message.parse(uploadJson.message);
    const lease = Lease.parse(uploadJson.lease);
    expect(lease.status).toBe('draft');
    expect(lease.unitId).toBe('MC-B-1204');
    expect(lease.ruleResults.every((r) => r.status === 'PASS')).toBe(true);
    expect(lease.record.rent.amount.source).toMatchObject({ clauseId: '2', verified: true });

    expect(doc.conversationId).toBe(conv.id);
    expect(doc.filename).toBe('lease-01-clean-MC-B-1204.pdf');
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.pageCount).toBe(1);
    expect(doc.clauses.map((c) => c.id)).toEqual([
      'preamble',
      'parties',
      'premises',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      'signatures',
    ]);

    expect(msg.role).toBe('user');
    expect(msg.text).toBe('');
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0]).toEqual({
      id: doc.id,
      filename: 'lease-01-clean-MC-B-1204.pdf',
      mimeType: 'application/pdf',
    });

    // 3. GET conversation includes message, document and the lease once the background analysis is done
    expect(lease.analysisStatus).toBe('pending');
    const getConvJson = await vi.waitFor(async () => {
      const res = await fetch(`${baseUrl}/api/conversations/${conv.id}`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { conversation: unknown; messages: unknown[]; documents: unknown[]; lease: unknown };
      expect(Lease.parse(json.lease).analysisStatus).toBe('done');
      return json;
    });
    expect(Conversation.parse(getConvJson.conversation).id).toBe(conv.id);
    expect(Lease.parse(getConvJson.lease).id).toBe(lease.id);
    expect(getConvJson.messages).toHaveLength(3);
    expect(Message.parse(getConvJson.messages[0]).id).toBe(msg.id);
    expect(Message.parse(getConvJson.messages[1]).role).toBe('assistant');
    expect(Message.parse(getConvJson.messages[2]).role).toBe('assistant');
    expect(getConvJson.documents).toHaveLength(1);
    expect(LeaseDocument.parse(getConvJson.documents[0]).id).toBe(doc.id);

    const parsedDetails = ConversationDetails.parse(getConvJson);
    expect(parsedDetails.review).not.toBeNull();
    expect(Array.isArray(parsedDetails.review?.pending)).toBe(true);
    expect(Array.isArray(parsedDetails.review?.highSeverityFailures)).toBe(true);

    // 4. GET document file returns identical bytes with inline disposition
    const fileRes = await fetch(`${baseUrl}/api/documents/${doc.id}/file`);
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get('content-type')).toContain('application/pdf');
    expect(fileRes.headers.get('content-disposition')).toBe('inline');
    const returnedBytes = Buffer.from(await fileRes.arrayBuffer());
    expect(returnedBytes).toEqual(pdfBuffer);

    // 5. A second lease in the same conversation is rejected
    const againForm = new FormData();
    againForm.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'again.pdf');
    const againRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/lease-document`, {
      method: 'POST',
      body: againForm,
    });
    expect(againRes.status).toBe(409);

    // 6. GET /api/conversations?kind=lease returns conversations that have documents
    const listRes = await fetch(`${baseUrl}/api/conversations?kind=lease`);
    expect(listRes.status).toBe(200);
    const summaries = z.array(ConversationSummary).parse(await listRes.json());
    expect(summaries.length).toBeGreaterThan(0);
    const summary = summaries.find((s) => s.id === conv.id);
    expect(summary).toBeDefined();
    expect(summary?.filename).toBe('lease-01-clean-MC-B-1204.pdf');
    expect(summary?.kind).toBe('lease');
  });

  it('POST /api/conversations/:id/lease-document rejects unsupported file format with 400', async () => {
    const convRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'lease' }),
    });
    const conv = Conversation.parse(await convRes.json());

    const formData = new FormData();
    formData.append('file', new Blob(['hello world'], { type: 'text/plain' }), 'lease.txt');

    const res = await fetch(`${baseUrl}/api/conversations/${conv.id}/lease-document`, {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('Unsupported document type');
  });

  it('POST /api/conversations/:id/lease-document rejects upload to issue conversation with 400', async () => {
    const convRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'issue', unitId: 'MC-B-1204' }),
    });
    const conv = Conversation.parse(await convRes.json());

    const pdfPath = resolve(import.meta.dirname, '../../../data/sample-leases/lease-01-clean-MC-B-1204.pdf');
    const pdfBuffer = readFileSync(pdfPath);
    const formData = new FormData();
    formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'lease-01.pdf');

    const res = await fetch(`${baseUrl}/api/conversations/${conv.id}/lease-document`, {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('is not a lease conversation');
  });

  it('GET /api/documents/:id/file returns 404 for missing document', async () => {
    const res = await fetch(`${baseUrl}/api/documents/non-existent-doc/file`);
    expect(res.status).toBe(404);
  });

  it('GET /api/documents/:id/file returns 404 when file is missing from disk', async () => {
    const conv = await repositories.conversations.create({
      id: 'conv-missing-file',
      kind: 'lease',
      unitId: null,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const doc: LeaseDocument = {
      id: 'doc-missing-file',
      conversationId: conv.id,
      filename: 'missing.pdf',
      mimeType: 'application/pdf',
      textSource: 'text',
      clauseSplit: 'headings',
      pageCount: 1,
      clauses: [],
      createdAt: new Date().toISOString(),
    };
    await repositories.documents.create(doc, 'missing.pdf');

    const res = await fetch(`${baseUrl}/api/documents/doc-missing-file/file`);
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Document file not found');
    expect(json.error).not.toContain(uploadDir);
  });

  it('POST /api/conversations/:id/lease-document returns 422 when image has no transcript text', async () => {
    const convRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'lease' }),
    });
    const conv = Conversation.parse(await convRes.json());

    const formData = new FormData();
    formData.append('file', new Blob([Buffer.from('fake-png-bytes')], { type: 'image/png' }), 'unknown.png');

    const res = await fetch(`${baseUrl}/api/conversations/${conv.id}/lease-document`, {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('No text found in the document');
  });

  it('POST /api/conversations/:id/lease-document uploads PNG sample returning 201 with textSource "image"', async () => {
    const convRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'lease' }),
    });
    const conv = Conversation.parse(await convRes.json());

    const pngPath = resolve(import.meta.dirname, '../../../data/sample-leases/lease-08-image-MC-A-0301.png');
    const pngBuffer = readFileSync(pngPath);
    const formData = new FormData();
    formData.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'lease-08-image-MC-A-0301.png');

    const res = await fetch(`${baseUrl}/api/conversations/${conv.id}/lease-document`, {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { document: LeaseDocument };
    const doc = LeaseDocument.parse(json.document);
    expect(doc.textSource).toBe('image');
    expect(doc.clauses.length).toBeGreaterThan(0);
  });

  it('HTTP review loop happy path: upload lease-01, wait for analysis, acceptAll, confirm, and verify cards and occupied unit', async () => {
    // 1. Create conversation
    const convRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'lease' }),
    });
    const conv = Conversation.parse(await convRes.json());

    // 2. Upload lease-01 PDF
    const pdfPath = resolve(import.meta.dirname, '../../../data/sample-leases/lease-01-clean-MC-B-1204.pdf');
    const pdfBuffer = readFileSync(pdfPath);
    const formData = new FormData();
    formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'lease-01-clean-MC-B-1204.pdf');

    const uploadRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/lease-document`, {
      method: 'POST',
      body: formData,
    });
    expect(uploadRes.status).toBe(201);
    const uploadJson = (await uploadRes.json()) as { messages: unknown[] };
    expect(uploadJson.messages).toHaveLength(1);
    const firstAssistantMessage = Message.parse(uploadJson.messages[0]);
    expect(firstAssistantMessage.role).toBe('assistant');
    expect(firstAssistantMessage.cards[0]?.type).toBe('summary');

    // 3. Wait for background analysis
    await vi.waitFor(async () => {
      const res = await fetch(`${baseUrl}/api/conversations/${conv.id}`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { lease: unknown };
      expect(Lease.parse(json.lease).analysisStatus).toBe('done');
    });

    // 4. Accept all fields
    const acceptAllRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'acceptAll' }),
    });
    expect(acceptAllRes.status).toBe(200);
    const acceptAllJson = (await acceptAllRes.json()) as { lease: unknown; messages: unknown[] };
    expect(acceptAllJson.messages).toHaveLength(2);

    // 5. Confirm lease
    const confirmRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'confirm', conversationId: conv.id }),
    });
    expect(confirmRes.status).toBe(200);
    const confirmJson = (await confirmRes.json()) as { lease: unknown; messages: unknown[] };
    const confirmedLease = Lease.parse(confirmJson.lease);
    expect(confirmedLease.status).toBe('confirmed');
    expect(confirmJson.messages).toHaveLength(2);
    expect(Message.parse(confirmJson.messages[0]).role).toBe('user');
    expect(Message.parse(confirmJson.messages[1]).role).toBe('assistant');
    expect(Message.parse(confirmJson.messages[1]).text).toBe('Lease confirmed. Unit MC-B-1204 marked occupied.');

    // 6. Verify unit occupied and conversation confirmed
    const convCheckRes = await fetch(`${baseUrl}/api/conversations/${conv.id}`);
    const convCheckJson = (await convCheckRes.json()) as { conversation: unknown };
    expect(Conversation.parse(convCheckJson.conversation).status).toBe('confirmed');

    const unitsRes = await fetch(`${baseUrl}/api/units`);
    expect(unitsRes.status).toBe(200);
    const units = z.array(Unit).parse(await unitsRes.json());
    const unit = units.find((u) => u.unitId === 'MC-B-1204');
    expect(unit?.status).toBe('occupied');

    // 7. Subsequent action returns 409
    const secondActionRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'acceptAll' }),
    });
    expect(secondActionRes.status).toBe(409);
  });

  it('POST /api/conversations/:id/messages processes typed correction through agent loop', async () => {
    const convRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'lease' }),
    });
    const conv = Conversation.parse(await convRes.json());

    const pdfPath = resolve(import.meta.dirname, '../../../data/sample-leases/lease-05-unknown-unit-rent-conflict.pdf');
    const pdfBuffer = readFileSync(pdfPath);
    const formData = new FormData();
    formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'lease-05-unknown-unit-rent-conflict.pdf');

    const uploadRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/lease-document`, {
      method: 'POST',
      body: formData,
    });
    expect(uploadRes.status).toBe(201);

    const messageRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'monthly rent is 8,000' }),
    });
    expect(messageRes.status).toBe(200);
    const json = (await messageRes.json()) as { lease: unknown; messages: unknown[] };
    const updatedLease = Lease.parse(json.lease);
    expect(updatedLease.record.rent.amount.value).toBe(8000);
    expect(json.messages).toHaveLength(2);
    const userMsg = Message.parse(json.messages[0]);
    expect(userMsg.role).toBe('user');
    expect(userMsg.text).toBe('monthly rent is 8,000');
    const assistantMsg = Message.parse(json.messages[1]);
    expect(assistantMsg.role).toBe('assistant');
    expect(assistantMsg.agentRun).not.toBeNull();
  });

  it('POST /api/conversations/:id/issue-report and GET /api/conversations/:id/photos/:photoId', async () => {
    // 1. Create an issue conversation
    const convRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'issue', unitId: 'MC-B-1204' }),
    });
    expect(convRes.status).toBe(201);
    const conv = Conversation.parse(await convRes.json());

    // 2. Submit issue report multipart
    const photoPath = resolve(import.meta.dirname, '../../../data/sample-photos/issue-01-ac-leak-1.jpg');
    const photoBuffer = readFileSync(photoPath);

    const formData = new FormData();
    formData.append('reporterRole', 'tenant');
    formData.append('note', 'AC unit is leaking water');
    formData.append('photos', new Blob([photoBuffer], { type: 'image/jpeg' }), 'issue-01-ac-leak-1.jpg');

    const reportRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/issue-report`, {
      method: 'POST',
      body: formData,
    });
    expect(reportRes.status).toBe(201);
    const reportData = ReportIssueResponse.parse(await reportRes.json());
    expect(reportData.issue.photos).toHaveLength(1);
    const photoId = reportData.issue.photos[0]?.id;
    expect(photoId).toBeDefined();

    // 3. GET photo file returns 200 with image/jpeg
    const photoRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/photos/${photoId}`);
    expect(photoRes.status).toBe(200);
    expect(photoRes.headers.get('content-type')).toContain('image/jpeg');
    const fetchedBytes = Buffer.from(await photoRes.arrayBuffer());
    expect(fetchedBytes).toEqual(photoBuffer);

    // 4. GET photo returns 404 for missing photo
    const missingPhotoRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/photos/non-existent-photo`);
    expect(missingPhotoRes.status).toBe(404);

    // 5. GET photo returns 404 for missing conversation
    const missingConvPhotoRes = await fetch(`${baseUrl}/api/conversations/non-existent-conv/photos/${photoId}`);
    expect(missingConvPhotoRes.status).toBe(404);
  });

  it('GET /api/conversations/:id/photos/:photoId returns 404 for an unknown conversation and for an unknown photoId on an existing issue', async () => {
    // 1. Create an issue conversation and submit an issue report with a photo
    const convRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'issue', unitId: 'MC-B-1204' }),
    });
    expect(convRes.status).toBe(201);
    const conv = Conversation.parse(await convRes.json());

    const photoPath = resolve(import.meta.dirname, '../../../data/sample-photos/issue-01-ac-leak-1.jpg');
    const photoBuffer = readFileSync(photoPath);

    const formData = new FormData();
    formData.append('reporterRole', 'tenant');
    formData.append('note', 'AC leak');
    formData.append('photos', new Blob([photoBuffer], { type: 'image/jpeg' }), 'photo.jpg');

    const reportRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/issue-report`, {
      method: 'POST',
      body: formData,
    });
    expect(reportRes.status).toBe(201);
    const reportData = ReportIssueResponse.parse(await reportRes.json());
    const validPhotoId = reportData.issue.photos[0]?.id;
    expect(validPhotoId).toBeDefined();

    // 2. Returns 404 for an unknown conversation
    const unknownConvRes = await fetch(`${baseUrl}/api/conversations/unknown-conv-id/photos/${validPhotoId}`);
    expect(unknownConvRes.status).toBe(404);

    // 3. Returns 404 for an unknown photoId on an existing issue
    const unknownPhotoRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/photos/unknown-photo-id`);
    expect(unknownPhotoRes.status).toBe(404);
  });
});

