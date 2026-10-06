import { expect, test } from '@playwright/test';

test('the suite runs on the stub model', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(await health.json()).toMatchObject({ status: 'ok', modelProvider: 'stub' });
});

test('review a clean lease, confirm it and find it under its unit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New lease review' }).click();
  await expect(page).toHaveURL(/#\/c\//);

  await page.locator('input[type="file"]').setInputFiles('data/sample-leases/lease-01-clean-MC-B-1204.pdf');

  // The stub extracts every field from the clause text, matched to MC-B-1204
  await page.getByRole('button', { name: /^Accept all \(\d+\)$/ }).click();
  await page.getByRole('button', { name: 'Confirm lease' }).click();
  await expect(page.getByText('✓ Lease confirmed')).toBeVisible();

  await page.getByRole('link', { name: /^← MC-B-1204/ }).click();
  await page.getByRole('link', { name: /Lease records/ }).click();
  const row = page.getByRole('link', { name: /lease-01-clean-MC-B-1204\.pdf/ });
  await expect(row).toContainText('Confirmed');
});
