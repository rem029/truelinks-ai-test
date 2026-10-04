import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { HealthResponse, Unit } from '@truelinks/shared';
import { createApp } from './app.js';
import { createDb } from './services/db/db.js';
import { migrateToLatest } from './services/db/migrations/migrate.js';
import { seed } from './services/db/seed.js';
import { createRepositories } from './services/db/repositories/index.js';

describe('API', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    const repositories = createRepositories(db);

    const app = createApp({ repositories });
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
  });

  it('GET /api/health returns 200 {status:"ok"} validating with shared schema', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    const validated = HealthResponse.parse(json);
    expect(validated).toEqual({ status: 'ok' });
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
});
