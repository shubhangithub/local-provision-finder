import {completeStaffSignIn} from './helpers/staff-sign-in';
import { expect, test } from '@playwright/test';

test('saved catalogue services and their detail pages persist', async ({ page }) => {
  await page.goto('/#/service/LP-003');
  await expect(page.getByRole('heading', { name: 'WorkWell Local Health Pathway' })).toBeVisible();
  await expect(page.getByText('Check area coverage before using this service')).toBeVisible();
  await expect(page.getByText('Not supplied — check with provider').first()).toBeVisible();
  await page.getByRole('button', { name: /^Save WorkWell Local Health Pathway/ }).first().click();
  await page.getByRole('link', { name: /^Saved/ }).click();
  await expect(page.getByRole('heading', { name: 'Saved services' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unsave WorkWell Local Health Pathway' })).toBeVisible();
});

test('staff mode preserves results and requires checked evidence before publishing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();await completeStaffSignIn(page);
  await page.evaluate(() => {location.hash='/review';});
  const venueCard = page.locator('.review-card').filter({ hasText: 'Community Confidence Circle' });
  await expect(venueCard.getByRole('complementary', { name: 'AI-assisted review guidance' })).toContainText('Generate AI review');
  const cards = page.locator('.review-list .review-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.locator('.review-advisor').count()).toBe(await cards.count());
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

test('the retired demo address lands on the standard search page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/demo');
  await expect(page.getByRole('heading', { name: 'What do you need help with?' })).toBeVisible();
  await expect(page).not.toHaveURL(/demo/);
  await expect(page.getByLabel('Postcode', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
