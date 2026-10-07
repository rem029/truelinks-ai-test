import { expect, test, type Page } from '@playwright/test';

function rowOf(page: Page, conversationId: string) {
  return page.getByRole('listitem').filter({ has: page.locator(`a[href="#/c/${conversationId}"]`) });
}

async function reportIssue(page: Page, unitId: string, photos: string[]): Promise<void> {
  await page.goto(`/#/report/${unitId}`);
  await page.getByRole('button', { name: 'Start report' }).click();
  await expect(page).toHaveURL(/#\/c\//);
  await page.getByRole('radio', { name: 'Inspector' }).check();
  await page.locator('input[type="file"]').setInputFiles(photos);
  await page.getByRole('button', { name: `Submit report (${photos.length} photos)` }).click();
  await expect(page.getByRole('button', { name: 'Accept work order' })).toBeVisible();
}

test('lease records filter to Draft, kept in the URL and undone by Back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New lease review' }).click();
  await expect(page).toHaveURL(/#\/c\//);
  const draftId = page.url().split('#/c/')[1] ?? '';
  await page.locator('input[type="file"]').setInputFiles('data/sample-leases/lease-01-clean-MC-B-1204.pdf');
  await expect(page.getByText(/^Rules: /).first()).toBeVisible();

  await page.goto('/#/u/MC-B-1204/leases');
  const chips = page.getByRole('group', { name: 'Filter lease records by status' });
  await expect(chips.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
  await chips.getByRole('button', { name: /^Draft/ }).click();
  await expect(page).toHaveURL(/#\/u\/MC-B-1204\/leases\?status=draft$/);
  await expect(chips.getByRole('button', { name: /^Draft/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(rowOf(page, draftId)).toBeVisible();
  await expect(page.getByText(/^Showing \d+ of \d+ lease records$/)).toBeVisible();

  await page.goBack();
  await expect(chips.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');

  // A unit whose only lease is the current one: Active shows it, and there is no Draft chip to offer
  await page.goto('/#/u/MC-A-0302/leases');
  await chips.getByRole('button', { name: /^Active/ }).click();
  await expect(page.getByRole('link', { name: /Confirmed/ })).toHaveCount(1);
  await expect(chips.getByRole('button', { name: /^Draft/ })).toHaveCount(0);
});

test('issues filter to Accepted, toggle Urgent, and an empty filter offers Show all', async ({ page }) => {
  await reportIssue(page, 'MC-A-0302', ['data/sample-photos/issue-02-tap-drip-1.jpg', 'data/sample-photos/issue-02-tap-drip-2.jpg']);
  await page.getByRole('button', { name: 'Accept work order' }).click();
  await expect(page.getByRole('button', { name: 'Accept work order' })).toHaveCount(0);
  await reportIssue(page, 'MC-A-0302', [
    'data/sample-photos/issue-03-water-heater-1.jpg',
    'data/sample-photos/issue-03-water-heater-2.jpg',
  ]);

  await page.goto('/#/u/MC-A-0302/issues');
  const chips = page.getByRole('group', { name: 'Filter issues by status' });
  const tapDrip = page.getByRole('link', { name: /leak|drip/i }).filter({ hasNotText: /water heater/i });
  const waterHeater = page.getByRole('link', { name: /water heater/i });
  await expect(tapDrip).toBeVisible();
  await expect(waterHeater).toBeVisible();

  await chips.getByRole('button', { name: /^Accepted/ }).click();
  await expect(page).toHaveURL(/\?status=accepted$/);
  await expect(tapDrip).toBeVisible();
  await expect(waterHeater).toHaveCount(0);
  await expect(page.getByText('Showing 1 of 2 issues')).toBeVisible();

  // Pressing the selected chip clears it; Urgent then narrows the whole list
  await chips.getByRole('button', { name: /^Accepted/ }).click();
  await chips.getByRole('button', { name: /^Urgent/ }).click();
  await expect(page).toHaveURL(/\?urgent=1$/);
  await expect(waterHeater).toBeVisible();
  await expect(tapDrip).toHaveCount(0);

  await page.goto('/#/u/MC-A-0302/issues?status=rejected');
  await expect(page.getByText('No issues match this filter.')).toBeVisible();
  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(page).toHaveURL(/#\/u\/MC-A-0302\/issues$/);
  await expect(tapDrip).toBeVisible();
  await expect(waterHeater).toBeVisible();
});
