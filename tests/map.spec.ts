import { expect, test, type Page } from '@playwright/test';
import { chooseArea, chooseRegion, openRegionMenu, showView } from './region-helpers';

async function openPicker(page: Page) {
  const panel = await openRegionMenu(page);
  await panel.getByText('Choose on the map', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Choose a search area on the map' }).locator('.leaflet-control-zoom-in')).toBeVisible();
}
function mapResponse(page: Page) {
  return page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/imports' && url.searchParams.has('bounds');
  });
}

test('location map selection works for all three directories and keeps unlocated services separate', async ({ page }) => {
  await page.goto('/');
  for (const area of ['Bristol', 'Kingston', 'Buckinghamshire']) {
    await openPicker(page);
    await page.getByLabel('Start the map at').selectOption(area);
    const pending = mapResponse(page);
    await page.getByRole('button', { name: 'Use this map area' }).click();
    const response = await pending;
    expect(response.ok()).toBe(true);
    const url = new URL(response.url());
    expect(url.searchParams.has('lat')).toBe(false);
    expect(url.searchParams.get('unknown')).toBe('0');
    const data = await response.json();
    expect(data.total).toBeGreaterThan(0);
    expect(data.records.length).toBeLessThanOrEqual(20);
    expect(data.mapRecords.length).toBe(data.total);
    const [west, south, east, north] = url.searchParams.get('bounds')!.split(',').map(Number);
    for (const record of data.mapRecords) {
      expect(record.sites.length).toBeGreaterThan(0);
      for (const site of record.sites) {
        expect(site.lat).toBeGreaterThanOrEqual(south); expect(site.lat).toBeLessThanOrEqual(north);
        expect(site.lng).toBeGreaterThanOrEqual(west); expect(site.lng).toBeLessThanOrEqual(east);
      }
    }
    await expect(page.locator('.results-count')).toHaveText(`${data.total} services`);
    await expect(page.getByText('Could not load the local directory. Please try again.')).toHaveCount(0);
    const withUnknown = mapResponse(page);
    await page.getByLabel('Include services without map locations').check();
    const expanded = await (await withUnknown).json();
    expect(expanded.total).toBeGreaterThanOrEqual(data.total);
    expect(expanded.unmappedCount).toBe(expanded.total - expanded.mappedCount);
  }
});

test('map navigation automatically searches or waits for explicit search and survives detail back', async ({ page }) => {
  await page.goto('/');
  await openPicker(page);
  const selected = mapResponse(page);
  await page.getByRole('button', { name: 'Use this map area' }).click();
  await selected;
  await showView(page, 'Map');
  const map = page.getByRole('region', { name: 'Map of service locations' });
  const zoom = map.locator('.leaflet-control-zoom-in');
  await expect(zoom).toBeVisible();
  const automatic = mapResponse(page);
  await zoom.click();
  const automaticResponse = await automatic;
  const initialBounds = new URL(automaticResponse.url()).searchParams.get('bounds');
  const initialData = await automaticResponse.json();
  await expect(page.locator('.results-count')).toHaveText(`${initialData.total} services`);
  await page.getByLabel('Search as I move the map').uncheck();
  let requests = 0;
  const listener = (request: {url(): string}) => {const url = new URL(request.url()); if (url.pathname === '/api/imports' && url.searchParams.has('bounds')) requests++;};
  page.on('request', listener);
  await zoom.click();
  const search = page.getByRole('button', { name: 'Search this map area', exact: true });
  await expect(search).toBeEnabled();
  await page.waitForTimeout(550);
  expect(requests).toBe(0);
  const manual = mapResponse(page);
  await search.click();
  const manualResponse = await manual;
  const finalBounds = new URL(manualResponse.url()).searchParams.get('bounds');
  expect(finalBounds).not.toBe(initialBounds);
  page.off('request', listener);
  await showView(page, 'List');
  await page.locator('.directory-results-list .import-service-link').first().click();
  const back = page.getByRole('button', { name: 'Back to results', exact: true });
  await expect(back).toHaveCount(1);
  await expect(back).toBeVisible();
  const backBox = await back.boundingBox();
  const sectionBox = await page.locator('.directory-service-detail').boundingBox();
  expect(Math.abs(backBox!.x - sectionBox!.x)).toBeLessThan(20);
  await back.click();
  await showView(page, 'Map');
  await expect(map.locator('.leaflet-control-zoom-in')).toBeVisible();
  const restored = mapResponse(page);
  await map.locator('.leaflet-control-zoom-out').click();
  const restoredResponse = await restored;
  expect(restoredResponse.ok()).toBe(true);
  const restoredBounds = new URL(restoredResponse.url()).searchParams.get('bounds')!.split(',').map(Number);
  const previousBounds = finalBounds!.split(',').map(Number);
  expect(Math.abs((restoredBounds[0]+restoredBounds[2])/2-(previousBounds[0]+previousBounds[2])/2)).toBeLessThan(0.002);
  expect(Math.abs((restoredBounds[1]+restoredBounds[3])/2-(previousBounds[1]+previousBounds[3])/2)).toBeLessThan(0.002);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('map API rejects malformed or reversed bounding boxes', async ({ request }) => {
  for (const bounds of ['undefined,1,2,3', '1,2,0,3', '-181,1,2,3', '1,2,3,91', '1,,3,4']) {
    const response = await request.get('/api/imports', { params: { bounds, mode: 'semantic' } });
    expect(response.status()).toBe(400);
  }
});

test('service links inside the region map picker open their service details',async({page})=>{
 await page.goto('/');await openPicker(page);await page.locator('.service-map-pin').first().waitFor();
 const index=await page.locator('.service-map-pin').evaluateAll(nodes=>nodes.findIndex(node=>{const pin=node.getBoundingClientRect(),map=node.closest('.services-map')!.getBoundingClientRect();return pin.top>map.top+10&&pin.bottom<map.bottom-10&&pin.left>map.left+60&&pin.right<map.right-20;}));
 expect(index).toBeGreaterThanOrEqual(0);await page.locator('.service-map-pin').nth(index).click({force:true});
 const link=page.locator('.map-service-link').first();const name=await link.innerText();await link.click();
 await expect(page.getByRole('region',{name:'Region settings'})).toBeHidden();
 await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'About this service',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back to results',exact:true}).click();await expect(page.getByRole('heading',{name:'What do you need help with?'})).toBeVisible();
});

async function visiblePins(page: Page) {
  return page.evaluate(() => {
    const box = document.querySelector('.directory-results-map .services-map')!.getBoundingClientRect();
    return [...document.querySelectorAll('.directory-results-map .service-map-pin')].filter(pin => {
      const rect = pin.getBoundingClientRect();
      return rect.right > box.left && rect.left < box.right && rect.bottom > box.top && rect.top < box.bottom;
    }).length;
  });
}
async function search(page: Page, text = 'support') {
  await page.getByLabel('What do you need help with?', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Find support', exact: true }).click();
  await showView(page, 'Map');
}

test('pins are in view on first render with no region, without sending a bounds search', async ({ page }) => {
  const bounded: string[] = [];
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/api/imports' && url.searchParams.has('bounds')) bounded.push(url.search); });
  await page.goto('/');
  await search(page);
  await expect.poll(() => visiblePins(page)).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  expect(await visiblePins(page)).toBeGreaterThan(0);
  expect(bounded).toEqual([]);
});

test('pins are in view after the region changes to somewhere the old view did not cover', async ({ page }) => {
  await page.goto('/');
  await chooseArea(page, 'Bristol');
  await search(page);
  await expect.poll(() => visiblePins(page)).toBeGreaterThan(0);
  await showView(page, 'List');
  await chooseArea(page, 'Kingston');
  await showView(page, 'Map');
  await expect.poll(() => visiblePins(page)).toBeGreaterThan(0);
  await showView(page, 'List');
  await chooseRegion(page, 'KT1');
  await showView(page, 'Map');
  await expect.poll(() => visiblePins(page)).toBeGreaterThan(0);
});

test('pins are in view after choosing a map area from the header', async ({ page }) => {
  await page.goto('/');
  await chooseArea(page, 'Bristol');
  await search(page);
  await expect.poll(() => visiblePins(page)).toBeGreaterThan(0);
  await showView(page, 'List');
  await openPicker(page);
  await page.getByLabel('Start the map at').selectOption('Kingston');
  const pending = mapResponse(page);
  await page.getByRole('button', { name: 'Use this map area' }).click();
  await pending;
  await showView(page, 'Map');
  await expect.poll(() => visiblePins(page)).toBeGreaterThan(0);
});
