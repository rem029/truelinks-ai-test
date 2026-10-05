import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type Issue,
  type IssuePhoto,
  type Message,
  type ConditionCard,
  type ReporterRole,
  type ReportIssueResponse,
} from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import type { ModelProvider } from '../agents/modelProvider/types.ts';
import { HttpError } from '../../utils/httpError.ts';
import { analyzePhotos, type PhotoAnalysis } from './analyzePhotos.ts';
import { buildIssueSummaryText } from './summaryText.ts';
import { issuePhotoPath } from './photoFiles.ts';
import { needsWorkOrder, runWorkOrderTurn } from './workOrderTurn.ts';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ReportIssuePhotoInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface ReportIssueInput {
  conversationId: string;
  reporterRole: ReporterRole;
  note?: string;
  photos: ReportIssuePhotoInput[];
}

export interface ReportIssueContext {
  repositories: Repositories;
  uploadDir: string;
  modelProvider: ModelProvider;
}

export async function reportIssue(
  input: ReportIssueInput,
  context: ReportIssueContext
): Promise<ReportIssueResponse> {
  const { conversationId, reporterRole, note, photos } = input;
  const { repositories, uploadDir, modelProvider } = context;

  const conversation = await repositories.conversations.get(conversationId);
  if (!conversation) {
    throw new HttpError(404, `Conversation ${conversationId} not found`);
  }

  if (conversation.kind !== 'issue' || !conversation.unitId) {
    throw new HttpError(400, 'Conversation must be an issue conversation with a unit assigned');
  }

  // More photos can be added (e.g. a clearer one) until a work order has been drafted from them
  const existingIssue = await repositories.issues.getByConversation(conversationId);
  if (existingIssue && (await repositories.issues.getWorkOrderByIssue(existingIssue.id))) {
    throw new HttpError(
      409,
      'A work order is already drafted for this issue; reply in the thread to change it'
    );
  }

  if (!photos || photos.length === 0) {
    throw new HttpError(400, 'At least 1 photo is required');
  }

  if (photos.length > 6) {
    throw new HttpError(400, 'Maximum 6 photos allowed');
  }

  for (const photo of photos) {
    if (!ALLOWED_MIME_TYPES.has(photo.mimeType)) {
      throw new HttpError(
        400,
        `Unsupported photo mime type '${photo.mimeType}'. Allowed: image/jpeg, image/png, image/webp`
      );
    }
  }

  // 1. Analyse first — model failure throws 502 with { reason }, saving nothing
  let analyses: PhotoAnalysis[];
  try {
    analyses = await analyzePhotos(photos, note, modelProvider);
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new HttpError(502, 'Photo analysis failed', { reason });
  }

  // 2. Prepare IDs and write files to ${uploadDir}/issues/<issueId>/<photoId>.<ext>
  const issueId = existingIssue?.id ?? randomUUID();
  const issueDir = resolve(uploadDir, 'issues', issueId);
  mkdirSync(issueDir, { recursive: true });

  const issuePhotos: IssuePhoto[] = photos.map((p, idx) => {
    const photoId = randomUUID();
    const filePath = issuePhotoPath(uploadDir, issueId, { id: photoId, mimeType: p.mimeType });
    writeFileSync(filePath, p.buffer);

    const analysis = analyses[idx]!;

    return {
      id: photoId,
      filename: p.originalName,
      mimeType: p.mimeType,
      condition: analysis.condition,
      damages: analysis.damages,
      equipment: analysis.equipment,
      note: analysis.note,
    };
  });

  const now = new Date().toISOString();

  const issue: Issue = existingIssue
    ? { ...existingIssue, photos: [...existingIssue.photos, ...issuePhotos] }
    : {
        id: issueId,
        unitId: conversation.unitId,
        conversationId,
        reporterRole,
        note: note?.trim() || undefined,
        photos: issuePhotos,
        createdAt: now,
      };

  const userMessage: Message = {
    id: randomUUID(),
    conversationId,
    role: 'user',
    text: note?.trim() || 'Reported an issue',
    cards: [],
    attachments: issuePhotos.map((p) => ({
      id: p.id,
      filename: p.filename,
      mimeType: p.mimeType,
    })),
    agentRun: null,
    createdAt: now,
  };

  const conditionCard: ConditionCard = {
    id: 'condition',
    type: 'condition',
    photos: issuePhotos,
  };

  const summaryText = buildIssueSummaryText(issuePhotos);

  const assistantMessage: Message = {
    id: randomUUID(),
    conversationId,
    role: 'assistant',
    text: summaryText,
    cards: [conditionCard],
    attachments: [],
    agentRun: null,
    // Order assistant response after user message when created in the same turn
    createdAt: new Date(Date.now() + 1).toISOString(),
  };

  // 3. Atomically persist issue and messages in transaction
  await repositories.transaction(async (trx) => {
    if (existingIssue) {
      await trx.issues.updatePhotos(issue.id, issue.photos);
    } else {
      await trx.issues.createIssue(issue);
    }
    await trx.conversations.addMessage(userMessage);
    await trx.conversations.addMessage(assistantMessage);
  });

  // 4. Draft the work order. The report is already saved, so a failure here leaves it in place and
  // the reporter can retry by sending a message.
  if (!needsWorkOrder(issue)) {
    return { issue, workOrder: null, messages: [userMessage, assistantMessage] };
  }
  const turn = await runWorkOrderTurn(conversationId, null, { repositories, modelProvider });
  return {
    issue,
    workOrder: turn.workOrder,
    messages: [userMessage, assistantMessage, ...turn.messages],
  };
}
