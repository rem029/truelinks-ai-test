import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { HttpError } from '../utils/httpError.ts';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.issues,
    });
    return;
  }

  if (err instanceof MulterError) {
    res.status(400).json({
      error: err.message,
      details: { code: err.code, field: err.field },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      details: err.details ?? null,
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  } else {
    console.error(err);
  }

  res.status(500).json({
    error: message,
    details: null,
  });
}
