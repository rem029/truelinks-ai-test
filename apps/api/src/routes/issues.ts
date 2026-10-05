import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ReporterRole } from '@truelinks/shared';
import type { Repositories } from '../services/db/repositories/index.ts';
import type { ModelProvider } from '../services/agents/modelProvider/types.ts';
import { reportIssue } from '../services/issues/reportIssue.ts';
import { getIssuePhoto } from '../services/issues/getPhoto.ts';
import { HttpError } from '../utils/httpError.ts';

const PostIssueReportBody = z.object({
  reporterRole: ReporterRole,
  note: z
    .string()
    .max(1000)
    .optional()
    .transform((val) => (val && val.trim() ? val.trim() : undefined)),
});

const ConversationParams = z.object({
  id: z.string().min(1),
});

const PhotoParams = z.object({
  id: z.string().min(1),
  photoId: z.string().min(1),
});

export function createIssuesRouter(
  repositories: Repositories,
  uploadDir: string,
  modelProvider: ModelProvider
): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  router.post('/conversations/:id/issue-report', upload.array('photos', 6), async (req, res) => {
    const { id: conversationId } = ConversationParams.parse(req.params);
    const body = PostIssueReportBody.parse(req.body);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    const photos = files.map((f) => ({
      buffer: f.buffer,
      originalName: f.originalname,
      mimeType: f.mimetype,
    }));

    const result = await reportIssue(
      {
        conversationId,
        reporterRole: body.reporterRole,
        note: body.note,
        photos,
      },
      { repositories, uploadDir, modelProvider }
    );

    res.status(201).json(result);
  });

  router.get('/conversations/:id/photos/:photoId', async (req, res, next) => {
    const { id: conversationId, photoId } = PhotoParams.parse(req.params);
    const photo = await getIssuePhoto(conversationId, photoId, { repositories, uploadDir });

    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(photo.filePath, (err) => {
      if (err) {
        next(new HttpError(404, 'Photo file not found'));
      }
    });
  });

  return router;
}
