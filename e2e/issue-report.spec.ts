import { expect, test } from '@playwright/test';

test('report an AC leak with photos, accept the drafted work order and find it under the unit', async ({ page }) => {
  await page.goto('/#/report/MC-B-1204');
  await page.getByRole('button', { name: 'Start report' }).click();
  await expect(page).toHaveURL(/#\/c\//);

  await page.getByRole('radio', { name: 'Inspector' }).check();
  await page
    .locator('input[type="file"]')
    .setInputFiles(['data/sample-photos/issue-01-ac-leak-1.jpg', 'data/sample-photos/issue-01-ac-leak-2.jpg']);
  await page.getByRole('button', { name: 'Submit report (2 photos)' }).click();

  await page.getByRole('button', { name: 'Accept work order' }).click();
  await expect(page.getByRole('button', { name: 'Accept work order' })).toHaveCount(0);

  await page.getByRole('link', { name: /^← MC-B-1204/ }).click();
  const row = page.getByRole('link', { name: /AC leak/ });
  await expect(row).toContainText('accepted');
});
