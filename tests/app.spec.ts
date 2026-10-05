import { expect, test } from '@playwright/test';

test('search, radius boundary, shortlist and persisted detail', async ({ page }) => {
  await page.goto('/#/demo');
  await page.getByRole('button', { name: 'Try example' }).click();
  await expect(page.getByRole('heading', { name: '1 service to explore' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'WorkWell Local Health Pathway' })).toBeVisible();
  await expect(page.getByText('Coverage needs checking', { exact: false })).toBeVisible();
  await expect(page.getByText('No matching housing service', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Community Confidence Circle' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show farther options' }).click();
  await expect(page.getByRole('heading', { name: '2 services to explore' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Community Confidence Circle' })).toBeVisible();
  await page.getByRole('button', { name: 'Save WorkWell Local Health Pathway', exact: true }).click();
  await page.getByRole('link', { name: /^Saved/ }).click();
  await expect(page.getByRole('heading', { name: 'Saved services' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unsave WorkWell Local Health Pathway' })).toBeVisible();
  await page.getByRole('link', { name: 'WorkWell Local Health Pathway' }).click();
  await expect(page.getByText('Check area coverage before using this service')).toBeVisible();
  await expect(page.getByText('Not supplied — check with provider').first()).toBeVisible();
});

test('staff mode preserves results and requires checked evidence before publishing', async ({ page }) => {
  await page.goto('/?q=anxiety&postcode=AB4&radius=3&remote=1');
  const publicTitles = await page.locator('.service-card h3').allTextContents();
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  expect(await page.locator('.service-card h3').allTextContents()).toEqual(publicTitles);
  await page.evaluate(() => {location.hash='/review';});
  const venueCard = page.locator('.review-card').filter({ hasText: 'Community Confidence Circle' });
  await venueCard.getByRole('button', { name: 'Review change' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Publish checked change' })).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Publish checked change' }).click();
  await page.getByRole('button', { name: /^Decision history/ }).click();
  await expect(page.getByText('Published ·', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Community Confidence Circle' }).click();
  await expect(page.getByText('Library Meeting Room 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Only the venue change was checked', { exact: false })).toBeVisible();
  await expect(page.getByText('Potentially outdated', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Details need checking', { exact: true })).toBeVisible();
});

test('invalid postcodes, unknown searches and responsive layout are handled', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/demo');
  await page.getByLabel('Postcode', { exact: true }).fill('SW1A 1AA');
  await page.getByRole('button', { name: 'Find support', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a demo postcode');
  await page.getByLabel('Postcode', { exact: true }).fill('AB4');
  await page.locator('#circumstances').fill('xyz');
  await page.getByRole('button', { name: 'Find support', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No matching services in this search' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
