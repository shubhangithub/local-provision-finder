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

test('the ended meeting is a stack of boxes with no summary or transcript',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await finishMeeting(page);
  await expect(page.getByRole('region',{name:'Meeting ended'})).toContainText(/Length \d+:\d\d · 0 services saved/);
  await expect(page.getByRole('region',{name:'Meeting ended'}).getByRole('button',{name:'Start another meeting'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Your next steps'}).getByRole('heading',{name:'Your next steps'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Follow-up call'})).toContainText('Tick services during the meeting');
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByText('Preparing a meeting summary')).toHaveCount(0);
});
