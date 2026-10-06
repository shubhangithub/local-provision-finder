import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { chooseRegion, openRegionMenu, useCurrentLocation } from './region-helpers';
test('choose a directory and search stored postcodes', async ({page}) => {
  await page.goto('/');
  await openRegionMenu(page);
  expect((await new AxeBuilder({page}).include('.region-panel').analyze()).violations).toEqual([]);
  await chooseRegion(page,'Bristol');
  await expect(page.locator('.results-count')).toHaveText(`${(await (await page.request.get('/api/imports?area=Bristol')).json()).total} services`);
  await chooseRegion(page,'BS4');
  await expect(page.locator('.results-main .service-card').first()).toBeVisible();
  const response = await page.request.get('/api/imports?area=BS4');
  const results = await response.json(); expect(results.total).toBeGreaterThan(0);
});
test('current location uses real coordinates; denial is recoverable', async ({page, context}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:51.4288,longitude:-2.59625});
  await page.goto('/');
  await useCurrentLocation(page);
  await expect(page.getByRole('heading',{name:'Search results'})).toBeVisible();
  await expect(page.locator('.results-main .service-card').first()).toBeVisible();
  const response = await page.request.get('/api/imports?lat=51.4288&lng=-2.59625');
  const data = await response.json(); expect(data.records[0].distanceMiles).toBe(0);
  expect(data.records.every((record: {distanceMiles:number | null}) => record.distanceMiles===null || record.distanceMiles<=10)).toBeTruthy();
  await expect(page).not.toHaveURL(/lat=/);
  await page.evaluate(() => {navigator.geolocation.getCurrentPosition = (_success, failure) => failure?.({code:1,message:'Denied',PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3});});
  await useCurrentLocation(page);
  await expect(page.getByRole('region',{name:'Region settings'}).getByRole('alert')).toContainText('Location access was declined');
});
