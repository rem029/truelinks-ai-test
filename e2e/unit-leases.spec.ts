import { expect, test, type Page } from '@playwright/test';

async function uploadLease(page: Page, file: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New lease review' }).click();
  await expect(page).toHaveURL(/#\/c\//);
  await page.locator('input[type="file"]').setInputFiles(file);
}

test('an occupied unit shows its current lease from the seed', async ({ page }) => {
  await page.goto('/#/u/MC-A-0302');
  const current = page.getByRole('region', { name: 'Current lease' });
  await expect(current).toContainText('Elena Petrova');
  await expect(current).toContainText('1 Mar 2025 – 28 Feb 2027');
  await expect(current).toContainText('QAR 10,500');

  await current.getByRole('link', { name: 'Open lease record' }).click();
  await expect(page.getByText('✓ Lease confirmed')).toBeVisible();
  await expect(page.getByText("Override: “Existing tenancy imported from the owner's records”")).toBeVisible();
});

test('a lease that starts after the current one ends passes R7 as the next lease', async ({ page }) => {
  await uploadLease(page, 'data/sample-leases/lease-07-docx-MC-A-0302.docx');
  await page.getByText(/^Rules: /).first().click();
  const r7 = page.getByRole('row', { name: /^R7/ }).first();
  await expect(r7).toContainText('PASS');
  await expect(r7).toContainText('Next lease: starts 2027-03-01, after the current lease ends (Elena Petrova, 2025-03-01 to 2027-02-28)');
});

test('a lease that overlaps the current one fails R7 and cannot be confirmed', async ({ page }) => {
  await uploadLease(page, 'data/sample-leases/lease-03-occupied-MC-B-1205.pdf');
  const r7 = page.locator('.rule-card', { has: page.getByRole('heading', { name: 'Rule: R7' }) }).first();
  await expect(r7).toContainText('FAIL');
  await expect(r7).toContainText('Overlaps the confirmed lease on MC-B-1205 (Thomas Reyes, 2025-07-01 to 2027-06-30)');

  // Clear every open item and give an override: the overlap is still refused, since only one lease can be in effect
  await page.getByRole('button', { name: /^Accept all \(\d+\)$/ }).click();
  const acknowledge = page.getByRole('button', { name: 'Acknowledge' });
  while ((await acknowledge.count()) > 0) {
    const before = await acknowledge.count();
    await acknowledge.first().click();
    await expect(acknowledge).toHaveCount(before - 1);
  }
  await expect(page.getByText('✓ Ready to confirm')).toBeVisible();
  await page.getByPlaceholder(/State why this lease is being confirmed/).fill('Tenant agreed to move early');
  await page.getByRole('button', { name: 'Confirm lease' }).click();
  await expect(page.getByRole('alert')).toContainText('only one lease can be in effect');
  await expect(page.getByText('✓ Lease confirmed')).toHaveCount(0);
});
