import { Router } from 'express';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Repositories } from '../db/repositories/index.ts';
import { HttpError } from '../utils/httpError.ts';

const DocumentParams = z.object({
  id: z.string().min(1),
});

export function createDocumentsRouter(repositories: Repositories, uploadDir: string): Router {
  const router = Router();

  router.get('/documents/:id/file', async (req, res, next) => {
    const { id } = DocumentParams.parse(req.params);
    const docResult = await repositories.documents.get(id);
    if (!docResult) {
      throw new HttpError(404, `Document ${id} not found`);
    }

    const absolutePath = resolve(uploadDir, docResult.filePath);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Type', docResult.document.mimeType);
    res.sendFile(absolutePath, (err) => {
      if (err) {
        next(new HttpError(404, 'Document file not found'));
      }
    });
  });

  return router;
}
