import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Clause, ClauseSplit, LeaseDocument, Message } from '@truelinks/shared';
import type { Repositories } from '../../db/repositories/index.ts';
import type { ModelProvider } from '../../agents/modelProvider/types.ts';
import { HttpError } from '../../../utils/httpError.ts';
import { isSupportedMimeType, readLeaseDocument, SUPPORTED_MIME_TYPES } from './readDocument.ts';
import { buildClauses, findHeadings, paragraphClauses, toLines } from './splitClauses.ts';
import { detectHeadingsWithModel } from './detectHeadings.ts';

export interface IngestLeaseInput {
  conversationId: string;
  file: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  };
}

export interface IngestLeaseContext {
  repositories: Repositories;
  uploadDir: string;
  modelProvider?: ModelProvider;
}

export interface IngestLeaseResult {
  document: LeaseDocument;
  message: Message;
}

export async function ingestLease(
  input: IngestLeaseInput,
  context: IngestLeaseContext
): Promise<IngestLeaseResult> {
  const startTime = Date.now();
  const { conversationId, file } = input;
  const { repositories, uploadDir, modelProvider } = context;

  const conversation = await repositories.conversations.get(conversationId);
  if (!conversation) {
    throw new HttpError(404, `Conversation ${conversationId} not found`);
  }
  if (conversation.kind !== 'lease') {
    throw new HttpError(400, `Conversation ${conversationId} is not a lease conversation (found '${conversation.kind}')`);
  }
  if (conversation.status !== 'open') {
    throw new HttpError(400, `Conversation ${conversationId} is not open (status: '${conversation.status}')`);
  }

  // One lease per conversation; checked before reading so a rejected upload leaves nothing behind
  if (await repositories.leases.getByConversation(conversationId)) {
    throw new HttpError(409, `Conversation ${conversationId} already has a lease; start a new conversation for another lease`);
  }

  if (!isSupportedMimeType(file.mimeType)) {
    throw new HttpError(400, `Unsupported document type '${file.mimeType}'. Only PDF, DOCX, PNG, and JPEG files are supported.`);
  }

  const { pages, textSource } = await readLeaseDocument(file.buffer, file.mimeType, {
    filename: file.originalName,
    modelProvider,
  });

  const totalText = pages.map((p) => p.text.trim()).join('');
  if (totalText.length === 0) {
    throw new HttpError(422, 'No text found in the document; scanned PDFs are not supported yet');
  }

  const lines = toLines(pages);
  const ruleHeadings = findHeadings(lines);
  const hasNumberedHeadings = ruleHeadings.some((h) => /^\d+$/.test(h.id));

  let clauses: Clause[];
  let clauseSplit: ClauseSplit;

  if (hasNumberedHeadings) {
    clauses = buildClauses(lines, ruleHeadings);
    clauseSplit = 'headings';
  } else {
    // Only invoke AI heading detection when rules find no numbered heading
    let aiClauses: Clause[] | null = null;
    if (modelProvider) {
      aiClauses = await detectHeadingsWithModel(lines, modelProvider);
    }

    if (aiClauses && aiClauses.length > 0) {
      clauses = aiClauses;
      clauseSplit = 'ai';
    } else if (ruleHeadings.length > 0) {
      clauses = buildClauses(lines, ruleHeadings);
      clauseSplit = 'headings';
    } else {
      clauses = paragraphClauses(lines);
      clauseSplit = 'paragraphs';
    }
  }

  const documentId = randomUUID();
  const ext = SUPPORTED_MIME_TYPES[file.mimeType];

  mkdirSync(uploadDir, { recursive: true });
  const relativeFilePath = `${documentId}${ext}`;
  const absoluteFilePath = join(uploadDir, relativeFilePath);
  writeFileSync(absoluteFilePath, file.buffer);

  const isPdf = file.mimeType === 'application/pdf';
  const isImage = file.mimeType === 'image/png' || file.mimeType === 'image/jpeg';
  const pageCount = isPdf ? pages.length : isImage ? 1 : null;

  const document: LeaseDocument = {
    id: documentId,
    conversationId,
    filename: file.originalName,
    mimeType: file.mimeType,
    textSource,
    clauseSplit,
    pageCount,
    clauses,
    createdAt: new Date().toISOString(),
  };
  await repositories.documents.create(document, relativeFilePath);

  const message: Message = {
    id: randomUUID(),
    conversationId,
    role: 'user',
    text: '',
    attachments: [
      {
        id: documentId,
        filename: file.originalName,
        mimeType: file.mimeType,
      },
    ],
    cards: [],
    createdAt: new Date().toISOString(),
  };
  await repositories.conversations.addMessage(message);

  const durationMs = Date.now() - startTime;
  const pagesReported = pageCount !== null ? String(pageCount) : '-';
  console.log(
    `lease ingest conversation=${conversationId} file=${ext} pages=${pagesReported} clauses=${clauses.length} source=${textSource} split=${clauseSplit} ms=${durationMs}`
  );

  return { document, message };
}
