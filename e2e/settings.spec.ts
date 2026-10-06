import { expect, test } from '@playwright/test';

test('rules: add, edit, delete, view and restore versions; units: add; a new lease is checked against the result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const ruleRow = (id: string) => settings.getByRole('listitem').filter({ hasText: new RegExp(`^${id}`) });
  await expect(settings.getByText(/Version 1\.0 ·/)).toBeVisible();
  await expect(ruleRow('R7')).toBeVisible();

  // Add a field comparison (checked by code) → 1.1
  await settings.getByRole('button', { name: 'Add rule' }).click();
  const addForm = settings.getByRole('form', { name: 'Add rule' });
  await addForm.getByRole('combobox', { name: /^Field/ }).selectOption({ label: 'Monthly Rent' });
  await addForm.getByRole('combobox', { name: /^Must be/ }).selectOption('<=');
  await addForm.getByRole('spinbutton', { name: /^Value/ }).fill('10000');
  await expect(addForm.getByText('Rule: Monthly Rent ≤ 10,000')).toBeVisible();
  await addForm.getByRole('button', { name: 'Save rule' }).click();
  await expect(settings.getByRole('status')).toHaveText('Added R8. The ruleset is now version 1.1.');

  // Add a plain-language rule (judged by the AI) → 1.2
  await settings.getByRole('button', { name: 'Add rule' }).click();
  await settings.getByLabel(/Plain language/).check();
  await settings.getByLabel('Rule, in plain words').fill('The lease must forbid subletting without written consent.');
  await settings.getByRole('button', { name: 'Save rule' }).click();
  await expect(ruleRow('R9')).toContainText('Judged by the AI');

  // Edit R8 to 9,000 → 1.3; its auto description follows the new comparison
  await settings.getByRole('button', { name: 'Edit R8' }).click();
  await settings.getByRole('form', { name: 'Edit R8' }).getByRole('spinbutton', { name: /^Value/ }).fill('9000');
  await settings.getByRole('button', { name: 'Save changes' }).click();
  await expect(settings.getByRole('status')).toHaveText('Saved R8. The ruleset is now version 1.3.');
  await expect(ruleRow('R8')).toContainText('Monthly Rent ≤ 9,000');

  // Delete R9 with the in-dialog confirmation → 1.4
  await settings.getByRole('button', { name: 'Delete R9' }).click();
  await settings.getByRole('button', { name: 'Yes, delete R9' }).click();
  await expect(settings.getByRole('status')).toHaveText('Deleted R9. The ruleset is now version 1.4.');
  await expect(ruleRow('R9')).toHaveCount(0);

  // An earlier version is read-only; restoring copies it forward → 1.5
  await settings.getByRole('combobox', { name: /^Version/ }).selectOption('1.3');
  await expect(ruleRow('R9')).toBeVisible();
  await expect(settings.getByRole('button', { name: 'Edit R8' })).toHaveCount(0);
  await settings.getByRole('button', { name: 'Restore this version' }).click();
  await expect(settings.getByRole('status')).toHaveText('Restored version 1.3. The ruleset is now version 1.5.');
  await expect(settings.getByRole('combobox', { name: /^Version/ })).toContainText('1.5 · Restored version 1.3');

  // A new unit joins an existing building and shows in the sidebar
  await settings.getByRole('button', { name: 'Units', exact: true }).click();
  await settings.getByRole('button', { name: 'Add unit' }).click();
  const unitForm = settings.getByRole('form', { name: 'Add unit' });
  await unitForm.getByLabel('Unit ID').fill('MC-B-1301');
  await unitForm.getByLabel('Label').fill('Apartment 1301');
  await unitForm.getByLabel('Area (m²)').fill('120');
  await unitForm.getByRole('button', { name: 'Save unit' }).click();
  await expect(settings.getByRole('status')).toHaveText('Added MC-B-1301.');
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.getByRole('link', { name: /MC-B-1301/ })).toBeVisible();

  // Lease 01 asks QAR 9,500 a month, so the edited R8 (≤ 9,000) fails on it
  await page.getByRole('button', { name: 'New lease review' }).click();
  await page.locator('input[type="file"]').setInputFiles('data/sample-leases/lease-01-clean-MC-B-1204.pdf');
  const r8 = page.locator('.rule-card', { has: page.getByRole('heading', { name: 'Rule: R8' }) }).first();
  await expect(r8).toContainText('FAIL');
  await expect(r8).toContainText('Monthly Rent is 9,500 (rule: Monthly Rent ≤ 9,000)');
});
