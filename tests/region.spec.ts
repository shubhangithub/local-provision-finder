import { expect, test } from './fixtures';
import { chooseArea, chooseRegion, openRegionMenu, showView } from './region-helpers';

const trigger = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Region settings/ });

test('the header cog opens region settings and Escape or an outside click closes them', async ({ page }) => {
  await page.goto('/');
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
  const panel = await openRegionMenu(page);
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toContainText('No region set');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger(page)).toBeFocused();
  await openRegionMenu(page);
  await page.mouse.click(900, 650);
  await expect(panel).toBeHidden();
});

test('there is no location picker inside the search area', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Location/ })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('What do you need help with?', { exact: true }).fill('food');
  await page.getByRole('button', { name: 'Find support', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Location/ })).toHaveCount(0);
});

test('a region is shown, persists across a reload and can be cleared', async ({ page }) => {
  await page.goto('/');
  await chooseArea(page, 'Kingston');
  await expect(trigger(page)).toHaveAccessibleName(/Kingston upon Thames/);
  await expect(page.getByText('Searching in Kingston upon Thames')).toBeVisible();
  await page.reload();
  await expect(trigger(page)).toHaveAccessibleName(/Kingston upon Thames/);
  const panel = await openRegionMenu(page);
  await panel.getByRole('button', { name: 'Clear region', exact: true }).click();
  await expect(trigger(page)).toHaveAccessibleName('Region settings');
  await page.reload();
  await expect(trigger(page)).toHaveAccessibleName('Region settings');
});

test('searching without a region covers all areas without mentioning them, and changing region re-runs the search', async ({ page }) => {
  const requests: URLSearchParams[] = [];
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/api/imports' && url.searchParams.get('mode') === 'semantic' && url.searchParams.has('page')) requests.push(url.searchParams); });
  await page.goto('/');
  await page.getByLabel('What do you need help with?', { exact: true }).fill('food');
  await page.getByRole('button', { name: 'Find support', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Search results' })).toBeVisible();
  await expect.poll(() => requests.some(params => params.get('q') === 'food' && !params.has('area'))).toBe(true);
  await chooseArea(page, 'Bristol');
  await expect.poll(() => requests.some(params => params.get('q') === 'food' && params.get('area') === 'Bristol' && params.get('page') === '1')).toBe(true);
  await chooseArea(page, 'Kingston');
  await expect.poll(() => requests.some(params => params.get('q') === 'food' && params.get('area') === 'Kingston')).toBe(true);
});

test('the region indicator appears only when a region is set and opens the header settings', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Searching in/)).toHaveCount(0);
  await expect(page.getByText(/all areas/i)).toHaveCount(0);
  await expect(trigger(page)).toHaveAccessibleName('Region settings');
  await chooseArea(page, 'Bristol');
  await expect(page.getByText('Searching in Bristol')).toBeVisible();
  await page.getByRole('button', { name: 'Change region' }).click();
  await expect(page.getByRole('region', { name: 'Region settings' })).toBeVisible();
});

test('the directory agent uses the header region instead of areas named in the message', async ({ page }) => {
  const requests: URLSearchParams[] = [];
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/api/imports') requests.push(url.searchParams); });
  await page.goto('/');
  await chooseArea(page, 'Bristol');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Ask agent', exact: true }).click();
  const agent = page.getByRole('complementary', { name: 'Directory agent' });
  await agent.getByLabel('Ask the agent', { exact: true }).fill('Find support for anxiety in Kingston');
  await agent.getByRole('button', { name: 'Ask agent', exact: true }).click();
  await expect(agent.getByRole('log')).toContainText('change the region in the header settings', { timeout: 15000 });
  expect(requests.some(params => params.get('q')?.includes('anxiety') && params.get('area') === 'Bristol')).toBe(true);
  expect(requests.some(params => params.get('q')?.includes('anxiety') && params.get('area') === 'Kingston')).toBe(false);
});

test.describe('results layout', () => {
  test('list on the left, full-height map on the right, first result above the fold', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Wide layout');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await chooseArea(page, 'Bristol');
    const first = page.locator('.results-main .service-card').first();
    await expect(first).toBeVisible();
    const list = (await page.locator('.directory-results-list').boundingBox())!;
    const map = (await page.locator('.directory-results-map').boundingBox())!;
    expect(map.x).toBeGreaterThan(list.x + list.width - 1);
    expect(map.height).toBeGreaterThan(560);
    const card = (await first.boundingBox())!;
    expect(card.y + card.height).toBeLessThanOrEqual(720);
    await page.mouse.wheel(0, 800);
    await expect(page.locator('.results-bar')).toBeInViewport();
    const stuck = (await page.locator('.directory-results-map').boundingBox())!;
    expect(stuck.y).toBeGreaterThanOrEqual(0);
    expect(stuck.y + stuck.height).toBeLessThanOrEqual(721);
    await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeHidden();
  });

  test('small screens switch between list and map with a bottom toggle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await chooseArea(page, 'Bristol');
    await expect(page.locator('.results-main .service-card').first()).toBeVisible();
    const toggle = page.getByRole('group', { name: 'Results view' });
    const box = (await toggle.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(700);
    await expect(page.locator('.directory-results-map')).toBeHidden();
    await showView(page, 'Map');
    await expect(page.locator('.directory-results-map')).toBeVisible();
    await expect(page.locator('.directory-results-list')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('no results keep the map visible and explain the empty list', async ({ page }) => {
    await page.route('**/api/imports?**', route => route.fulfill({ json: { total: 0, records: [], mapRecords: [], mappedCount: 0, unmappedCount: 0, searchMode: 'semantic' } }));
    await page.goto('/');
    await chooseRegion(page, 'Bristol');
    await expect(page.getByRole('heading', { name: 'No matching services' })).toBeVisible();
    await showView(page, 'Map');
    await expect(page.getByRole('region', { name: 'Map of service locations' })).toBeVisible();
  });
});
