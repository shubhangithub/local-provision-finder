import {completeStaffSignIn} from './helpers/staff-sign-in';
import { expect, test } from './fixtures';

test('staff sees real queue counts while public notifications hide them', async ({ page }) => {
  let resolved=false;
  await page.route('**/api/feedback', route=>route.fulfill({json:{entries:resolved ? [{status:'resolved'}] : [{status:'pending'},{status:'checking'},{status:'resolved'}]}}));
  await page.route('**/api/suggestions', route=>route.fulfill({json:{entries:resolved ? [{status:'published'}] : [{status:'submitted'},{status:'draft'},{status:'published'},{status:'rejected'}]}}));
  await page.goto('/');
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const panel=page.getByRole('region', { name: 'Notifications', exact: true });
  await expect(panel).toContainText('You’re all caught up.');
  await page.getByRole('button', { name: 'Close notifications' }).click();
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();await completeStaffSignIn(page);
  // The Staff button totals both queues; inside the menu each queue shows its own count.
  await expect(page.getByRole('button',{name:/^Staff/}).getByLabel('4 awaiting review')).toBeVisible();
  await page.getByRole('button',{name:/^Staff/}).click();
  const nav=page.getByRole('navigation',{name:'Staff menu'});
  await expect(nav.getByLabel('2 awaiting review')).toHaveCount(2);
  await expect(nav.getByRole('link',{name:/Service reports/}).getByLabel('2 awaiting review')).toBeVisible();
  await expect(nav.getByRole('link',{name:/New listings to approve/}).getByLabel('2 awaiting review')).toBeVisible();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(panel).toContainText('You’re all caught up.');
  await page.getByRole('button', { name: 'Close notifications' }).click();
  resolved=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('directory-updated')));
  await expect(nav.getByLabel('2 awaiting review')).toHaveCount(0);
  await expect(nav.getByLabel('0 awaiting review')).toHaveCount(2);
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(panel).toContainText('You’re all caught up.');
  await expect(panel.getByRole('heading', {name:'Feedback needs review'})).toHaveCount(0);
});

test('recommendation feedback keeps its context and can be deferred', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('lp-service-reminders-v1',JSON.stringify([{id:'test-recommended',name:'A recommended service',reason:'recommended',createdAt:new Date().toISOString()}])));
  await page.reload();

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
