import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Action, ConversationKind } from '@truelinks/shared';
import type { Repositories } from '../db/repositories/index.ts';
import type { ModelProvider } from '../services/agents/modelProvider/types.ts';
import { createConversation } from '../services/conversations/createConversation.ts';
import { getConversation } from '../services/conversations/getConversation.ts';
import { listConversations } from '../services/conversations/listConversations.ts';
import { ingestLease } from '../services/leases/ingest/ingestLease.ts';
import { extractLease } from '../services/leases/extract/extractLease.ts';
import { analyzeLease } from '../services/leases/extract/analyzeLease.ts';
import { addFirstReviewMessage } from '../services/leases/review/reviewMessage.ts';
import { applyAction, postMessage } from '../services/conversations/conversationTurn.ts';
import { HttpError } from '../utils/httpError.ts';

const CreateConversationBody = z.object({
  kind: ConversationKind,
  unitId: z.string().nullable().optional(),
});

const ListConversationsQuery = z.object({
  kind: ConversationKind.optional(),
});

const PostMessageBody = z.object({
  text: z.string().trim().min(1).max(2000),
});

const ConversationParams = z.object({
  id: z.string().min(1),
});

export function createConversationsRouter(
  repositories: Repositories,
  uploadDir: string,
  modelProvider: ModelProvider
): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  router.get('/conversations', async (req, res) => {
    const query = ListConversationsQuery.parse(req.query);
    const summaries = await listConversations(query, repositories);
    res.json(summaries);
  });

  router.post('/conversations', async (req, res) => {
    const body = CreateConversationBody.parse(req.body);
    const conversation = await createConversation(body, repositories);
    res.status(201).json(conversation);
  });

  router.get('/conversations/:id', async (req, res) => {
    const { id } = ConversationParams.parse(req.params);
    const details = await getConversation(id, repositories);
    res.json(details);
  });

  router.post('/conversations/:id/lease-document', upload.single('file'), async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, 'File is required');
    }

    const { id: conversationId } = ConversationParams.parse(req.params);
    const result = await ingestLease(
      {
        conversationId,
        file: {
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        },
      },
      { repositories, uploadDir, modelProvider }
    );
    const lease = await extractLease(result.document, { repositories, modelProvider });
    const reviewMessage = await addFirstReviewMessage(lease, result.document.filename, repositories);

    // The owner starts reviewing now; the full analysis adds its flags when done (lease.analysisStatus)
    analyzeLease(lease, result.document, { repositories, modelProvider }).catch((err: unknown) => {
      console.error(`lease analyze lease=${lease.id} could not be saved`, err);
    });

    res.status(201).json({ ...result, lease, messages: [reviewMessage] });
  });

  router.post('/conversations/:id/actions', async (req, res) => {
    const { id: conversationId } = ConversationParams.parse(req.params);
    const action = Action.parse(req.body);
    const outcome = await applyAction(conversationId, action, { repositories, modelProvider });
    res.json(outcome);
  });

  router.post('/conversations/:id/messages', async (req, res) => {
    const { id: conversationId } = ConversationParams.parse(req.params);
    const { text } = PostMessageBody.parse(req.body);
    const outcome = await postMessage(conversationId, text, { repositories, modelProvider });
    res.json(outcome);
  });

  return router;
}
