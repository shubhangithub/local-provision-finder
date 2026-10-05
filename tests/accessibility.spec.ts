import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('main pages have no automated WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  const scan = async () => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    expect(result.violations).toEqual([]);
  };
  await scan();
  await page.goto('/#/demo');
  await page.getByRole('button', { name: 'Try example' }).click();
  await scan();
  await page.getByRole('link', { name: 'WorkWell Local Health Pathway' }).click();
  await scan();
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await page.evaluate(() => {location.hash='/review';});
  await scan();
  await page.locator('.review-card').filter({ hasText: 'Community Confidence Circle' }).getByRole('button', { name: 'Review change' }).click();
  await scan();
});
