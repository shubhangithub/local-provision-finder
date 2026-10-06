import {completeStaffSignIn} from './helpers/staff-sign-in';
import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DatabaseSync } from 'node:sqlite';
import { chooseRegion } from './region-helpers';
test('user report is reviewed and a checked field correction reaches service details',async ({page,request},testInfo)=>{
  const listing=await (await request.get('/api/imports?area=Kingston')).json();
  const summary=listing.records[testInfo.project.name==='desktop' ? 5 : 6];
  const original=(await (await request.get(`/api/imports/service?id=${encodeURIComponent(summary.id)}`)).json()).record;
  const correctedCost=`Free after eligibility check ${Date.now()}`;
  const note=`Browser feedback check ${testInfo.project.name} ${Date.now()}`;
  let reportId:string | undefined;
  try {
    await page.goto(`/#/directory/${encodeURIComponent(summary.id)}`);
    await page.getByRole('button',{name:'Give feedback',exact:true}).click();
    await page.getByLabel('Some details have changed',{exact:true}).check();
    await page.getByRole('group',{name:'Which details need checking?'}).getByLabel('Availability',{exact:true}).check();
    await page.getByLabel('Anything else we should check? (optional)').fill(note);
    await page.getByRole('button',{name:'Send feedback',exact:true}).click();
    await expect(page.getByText('Thank you. Your feedback is in the review queue.')).toBeVisible();
    const entries=(await (await request.get('/api/feedback')).json()).entries;
    reportId=entries.find((entry:{note:string})=>entry.note===note).id;
    await page.getByRole('button',{name:'Staff sign in',exact:true}).click();await completeStaffSignIn(page);
    await page.getByRole('link',{name:'Review feedback',exact:true}).click();
    await page.locator('.report-row').filter({hasText:summary.name}).getByRole('button',{name:'Review report'}).click();
    await page.getByLabel('Detail to correct').selectOption('cost');
    await page.getByLabel('Checked value').fill(correctedCost);
    await page.getByLabel('Evidence and review note').fill('Test provider confirms free eligibility-based support.');
    await expect(page.getByRole('button',{name:'Publish checked correction'})).toBeDisabled();
    await page.getByLabel('I have checked the evidence for this decision.').check();
    await page.getByRole('button',{name:'Publish checked correction'}).click();
    await expect(page.getByText('Checked correction published. Other source dates are unchanged.')).toBeVisible();
    const updated=(await (await request.get(`/api/imports/service?id=${encodeURIComponent(summary.id)}`)).json()).record;
    expect(updated.cost).toBe(correctedCost);expect(updated.lastVerified).toBe(original.lastVerified);expect(updated.sourceUpdatedAt).toBe(original.sourceUpdatedAt);
    await page.getByRole('button',{name:/^History \(/}).click();
    await expect(page.locator('.review-card').filter({hasText:summary.name}).getByText('Corrected Cost').first()).toBeVisible();
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
  } finally {
    if (reportId) {const db=new DatabaseSync('data/feedback.sqlite');db.prepare('DELETE FROM corrections WHERE feedback_id=?').run(reportId);db.prepare('DELETE FROM feedback WHERE id=?').run(reportId);db.close();}
  }
});
test('feedback notification opens the prompt and real services can be saved',async ({page,request})=>{
  await page.goto('/');await chooseRegion(page,'Bristol');
  const first=page.locator('.directory-results-list .service-card').first();await expect(first).toBeVisible();
  const name=await first.locator('.import-service-link').innerText();
  await first.getByRole('button',{name:/^Save /}).click();
  await page.getByRole('link',{name:/^Saved/}).click();await expect(page.getByRole('heading',{name:'Saved services'})).toBeVisible();
  await page.locator('.saved-directory-services .import-service-link').first().click();
  await expect(page.getByRole('heading',{name:name.replace('→','').trim(),exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Notifications',exact:true}).click();
  const panel=page.getByRole('region',{name:'Notifications',exact:true});await expect(panel).toContainText('You recently viewed');
  await panel.getByRole('button',{name:'Give feedback',exact:true}).click();
  await expect(page.getByRole('group',{name:'Are the service details still correct?'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'All retained service text'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('feedback API rejects unsupported fields and cross-origin submissions',async ({request})=>{
  const data=await (await request.get('/api/imports?area=Bristol')).json();
  const invalid=await request.post('/api/feedback',{data:{serviceId:data.records[0].id,answers:{upToDate:'changed',issues:['lastVerified']}}});expect(invalid.status()).toBe(400);
  const crossOrigin=await request.post('/api/feedback',{headers:{Origin:'https://other.example'},data:{serviceId:data.records[0].id,answers:{upToDate:'yes',issues:[]}}});expect(crossOrigin.status()).toBe(403);
});
