import { expect, test } from '@playwright/test';

// Runs first (files run in name order): the suite starts on the stub model with an empty database
test('starts on the stub model with only the seeded units', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(await health.json()).toMatchObject({ status: 'ok', modelProvider: 'stub' });

  const conversations = await request.get('/api/conversations');
  expect(await conversations.json()).toEqual([]);

  const units = await request.get('/api/units');
  expect(await units.json()).toHaveLength(5);
});
