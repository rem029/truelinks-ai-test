import { expect, test } from '@playwright/test';

// Runs first (files run in name order): the suite starts on the stub model with only the seed data
test('starts on the stub model with the seeded units and current leases', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(await health.json()).toMatchObject({ status: 'ok', modelProvider: 'stub' });

  const conversations = await request.get('/api/conversations');
  // The occupied units come with their lease in effect, confirmed from the owner's records
  const reviews = (await conversations.json()) as { kind: string; unitId: string; leaseStatus: string }[];
  expect(reviews.map((r) => [r.kind, r.unitId, r.leaseStatus]).sort()).toEqual([
    ['lease', 'MC-A-0302', 'confirmed'],
    ['lease', 'MC-B-1205', 'confirmed'],
  ]);

  const units = await request.get('/api/units');
  expect(await units.json()).toHaveLength(5);
});
