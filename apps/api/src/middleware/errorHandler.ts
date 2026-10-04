import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

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
