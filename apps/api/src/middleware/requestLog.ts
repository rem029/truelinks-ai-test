import type { Request, Response, NextFunction } from 'express';

export function requestLog(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
}
