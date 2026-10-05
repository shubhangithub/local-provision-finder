import { expect, test } from '@playwright/test';

test('general information updates can be opened and dismissed', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const module=await import('/src/lib/notifications.ts');
    module.notifyServiceUpdated('test-service','Local support service','Opening times');
  });
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const panel=page.getByRole('region', { name: 'Notifications', exact: true });
  await expect(panel.getByRole('heading', { name: 'Information updated' })).toBeVisible();
  await expect(panel).toContainText('Opening times has been checked and updated');
  await page.reload();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Information updated' })).toBeVisible();
  await panel.getByRole('button', { name: 'Dismiss Information updated for test-service' }).click();
  await expect(panel).toContainText('You’re all caught up.');
});

test('staff sees real queue counts while public notifications hide them', async ({ page }) => {
  let resolved=false;
  await page.route('**/api/feedback', route=>route.fulfill({json:{entries:resolved ? [{status:'resolved'}] : [{status:'pending'},{status:'checking'},{status:'resolved'}]}}));
  await page.route('**/api/suggestions', route=>route.fulfill({json:{suggestions:resolved ? [{status:'published'}] : [{status:'submitted'},{status:'draft'},{status:'published'},{status:'rejected'}]}}));
  await page.goto('/');
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const panel=page.getByRole('region', { name: 'Notifications', exact: true });
  await expect(panel).toContainText('You’re all caught up.');
  await page.getByRole('button', { name: 'Close notifications' }).click();
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(panel).toContainText('2 reports need checking.');
  await expect(panel).toContainText('2 suggestions are awaiting review.');
  resolved=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('directory-updated')));
  await expect(panel).toContainText('You’re all caught up.');
  await expect(panel.getByRole('heading', {name:'Feedback needs review'})).toHaveCount(0);
});

test('recommendation feedback keeps its context and can be deferred', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const module=await import('/src/lib/notifications.ts');
    module.rememberService('test-recommended','A recommended service','recommended');
  });
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const panel=page.getByRole('region', { name: 'Notifications', exact: true });
  await expect(panel).toContainText('You were recommended A recommended service.');
  await expect(panel).toContainText('Did you find this recommendation useful?');
  await panel.getByRole('button', {name:'Later', exact:true}).click();
  await expect(panel).toContainText('You’re all caught up.');
  await page.reload();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(panel).toContainText('You’re all caught up.');
});
