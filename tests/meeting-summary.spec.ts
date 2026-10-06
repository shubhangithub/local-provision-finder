import { completeStaffSignIn } from './helpers/staff-sign-in';
import { expect, test } from './fixtures';

import { mockMicrophone, mockRealtime } from './meeting-helpers';
import { chooseArea } from './region-helpers';

const words = [
  [50, { type: 'transcript', itemId: 'a', text: 'I want to get back into work.', final: true }],
  [100, { type: 'transcript', itemId: 'b', text: 'I also need childcare after school.', final: true }],
] as [number, Record<string, unknown>][];

async function finishMeeting(page: import('@playwright/test').Page, area?: string) {
  await mockMicrophone(page);
  await mockRealtime(page, { messages: words });
  await page.goto('/');
  await page.getByRole('button',{name:'Staff sign in',exact:true}).click();
  await completeStaffSignIn(page);
  await page.getByRole('button', { name: /^Staff/ }).click();
  await page.getByRole('link', { name: 'Start meeting', exact: true }).click();
  if (area) await chooseArea(page, area);
  await page.getByRole('button',{name:'Start meeting',exact:true}).click();
  await expect(page.getByText('13 words captured')).toBeVisible();
  await page.getByRole('button',{name:'Stop meeting',exact:true}).click();
}

test('summary failure allows staff to retry',async({page})=>{
  let fail=true;
  await page.route('**/api/assistant',route=>fail?route.fulfill({status:503,json:{error:'Unavailable'}}):route.fulfill({json:{mode:'local',summary:'Second try worked.',answer:'',needs:[],nextSteps:[],citations:[],services:[],warnings:[]}}));
  await finishMeeting(page);
  await expect(page.getByRole('alert')).toContainText('Unavailable');
  fail=false;
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.getByRole('region',{name:'Meeting summary'})).toContainText('Second try worked.');
});

test('after the meeting the next steps and actions fit on one screen, with details in tabs',async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await page.route('**/api/assistant',route=>route.fulfill({json:{mode:'local',summary:'Draft',answer:'',needs:[],nextSteps:[],citations:[],services:[],warnings:[]}}));
  await finishMeeting(page);
  const report=page.getByRole('region',{name:'Your next steps'});
  await expect(report.getByRole('heading',{name:'Your next steps'})).toBeInViewport();
  await expect(report.getByRole('button',{name:'Print or save as PDF'})).toHaveCount(0);
  await expect(page.getByRole('tab',{name:/More suggestions/})).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'Summary'})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('region',{name:'Transcript'})).toHaveCount(0);
  await page.getByRole('tab',{name:'Transcript'}).click();
  await expect(page.getByRole('region',{name:'Transcript'})).toContainText('childcare after school');
  await page.getByRole('tab',{name:'Transcript'}).press('ArrowLeft');
  await expect(page.getByRole('tab',{name:'Summary'})).toBeFocused();
});
