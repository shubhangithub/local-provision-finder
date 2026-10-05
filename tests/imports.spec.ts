import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('staff can search full source text and inspect preserved contacts', async ({ page, request }) => {
  const response = await request.get('/api/imports?q=anxiety');
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.total).toBeGreaterThan(0);
  expect(data.records.length).toBeLessThanOrEqual(20);
  expect(data.records.every((r: { vetting: string }) => r.vetting === 'internal')).toBe(true);
  await page.goto('/#/imports');
  await page.getByRole('button', { name: 'Enter staff demo' }).click();
  const allRecords = await (await request.get('/api/imports')).json();
  await expect(page.getByText(`${allRecords.total} source records`, { exact: true })).toBeVisible();
  await page.getByLabel('Search the full service text').fill('anxiety');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText(`${data.total} source records matching “anxiety”`)).toBeVisible();
  await page.locator('.import-service-link').first().click();
  await expect(page.getByRole('heading', { name: 'Published contacts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'All retained service text' })).toHaveCount(0);
  const detail = await (await request.get(`/api/imports/service?id=${data.records[0].id}`)).json();
  expect(detail.record.searchText.length).toBeGreaterThan(0);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('read-only catalogue API rejects mutations and missing IDs', async ({ request }) => {
  const mutation = await request.post('/api/imports', { data: { vetting: 'public' } });
  expect(mutation.status()).toBe(405);
  const missing = await request.get('/api/imports/service?id=missing');
  expect(missing.status()).toBe(404);
  const escaped = await request.get('/api/imports?q=%25');
  expect(escaped.ok()).toBe(true);
});
