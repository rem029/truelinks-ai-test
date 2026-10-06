import { expect, test, type Page } from '@playwright/test';

// The row of one conversation in a unit's list, found by its thread link
function rowOf(page: Page, conversationId: string) {
  return page.getByRole('listitem').filter({ has: page.locator(`a[href="#/c/${conversationId}"]`) });
}

test('a draft lease review is archived and deleted from its row, each after a confirmation', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New lease review' }).click();
  await expect(page).toHaveURL(/#\/c\//);
  const conversationId = page.url().split('#/c/')[1] ?? '';
  await page.locator('input[type="file"]').setInputFiles('data/sample-leases/lease-01-clean-MC-B-1204.pdf');
  await expect(page.getByText(/^Rules: /).first()).toBeVisible();

  await page.goto('/#/u/MC-B-1204/leases');
  await rowOf(page, conversationId).getByRole('button', { name: /^Archive / }).click();
  const archiveDialog = page.getByRole('dialog', { name: 'Archive this lease review?' });
  await expect(archiveDialog).toContainText('lease-01-clean-MC-B-1204.pdf');
  await archiveDialog.getByRole('button', { name: 'Archive' }).click();
  await expect(archiveDialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Lease review archived: lease-01-clean-MC-B-1204.pdf');
  await expect(rowOf(page, conversationId)).toHaveCount(0);
  // The row's button is gone, so focus lands on the page heading rather than the top of the document
  await expect(page.getByRole('heading', { level: 1, name: 'MC-B-1204' })).toBeFocused();

  // Still reachable under "Show archived", where it can be deleted
  await page.getByRole('button', { name: /^Show archived/ }).click();
  await rowOf(page, conversationId).getByRole('button', { name: /^Delete / }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete this lease review permanently?' });
  await deleteDialog.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(rowOf(page, conversationId)).toHaveCount(0);
  expect((await request.get(`/api/conversations/${conversationId}`)).status()).toBe(404);
});

test("the unit's current lease offers no Archive, and the API refuses it", async ({ page, request }) => {
  await page.goto('/#/u/MC-A-0302');
  await page.getByRole('region', { name: 'Current lease' }).getByRole('link', { name: 'Open lease record' }).click();
  await expect(page.getByText('✓ Lease confirmed')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Archive / })).toHaveCount(0);

  const conversationId = page.url().split('#/c/')[1] ?? '';
  const refused = await request.post(`/api/conversations/${conversationId}/archive`);
  expect(refused.status()).toBe(409);
  expect((await refused.json()).error).toBe("This is the unit's current lease, so it can't be archived");
});
