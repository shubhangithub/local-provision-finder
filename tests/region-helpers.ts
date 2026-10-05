import { expect, type Page } from '@playwright/test';

/** Opens the header region dropdown. */
export async function openRegionMenu(page: Page) {
  const panel = page.getByRole('region', { name: 'Region settings' });
  if (!(await panel.isVisible())) await page.getByRole('button', { name: /^Region settings/ }).click();
  await expect(panel).toBeVisible();
  return panel;
}

/** Sets the region from the header dropdown by typing a town, area name or postcode. */
export async function chooseRegion(page: Page, text: string) {
  const panel = await openRegionMenu(page);
  await panel.getByLabel('Town or postcode').fill(text);
  await panel.getByRole('button', { name: 'Use this area', exact: true }).click();
  await expect(panel).toBeHidden();
}

/** Sets the region to a named area using the dropdown's area list. */
export async function chooseArea(page: Page, area: string) {
  const panel = await openRegionMenu(page);
  await panel.getByLabel('Area', { exact: true }).selectOption(area);
  await expect(panel).toBeHidden();
}

export async function useCurrentLocation(page: Page) {
  const panel = await openRegionMenu(page);
  await panel.getByRole('button', { name: 'Use current location', exact: true }).click();
}

/** The list/map toggle only exists below 1024px; on wide screens both are already visible. */
export async function showView(page: Page, view: 'List' | 'Map') {
  const toggle = page.getByRole('button', { name: view, exact: true });
  if (await toggle.isVisible()) await toggle.click();
}
