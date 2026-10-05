import { expect, test } from './fixtures';

import { mockMicrophone, mockRealtime } from './meeting-helpers';

const words = [
  [50, { type: 'transcript', itemId: 'a', text: 'I want to get back into work.', final: true }],
  [100, { type: 'transcript', itemId: 'b', text: 'I also need childcare after school.', final: true }],
] as [number, Record<string, unknown>][];

async function finishMeeting(page: import('@playwright/test').Page, area?: string) {
  await mockMicrophone(page);
  await mockRealtime(page, { messages: words });
  await page.goto('/');
  await page.getByRole('button',{name:'Staff sign in',exact:true}).click();
  if (area) await page.getByLabel('Find support in',{exact:true}).selectOption(area);
  await page.getByRole('button',{name:'Start meeting',exact:true}).click();
  await expect(page.getByRole('region',{name:'Transcript'})).toContainText('childcare after school');
  await page.getByRole('button',{name:'Stop meeting',exact:true}).click();
}

test('summary starts automatically from only the displayed transcript and links grounded evidence',async({page})=>{
  let sent:Record<string,unknown>={};
  await page.route('**/api/assistant',async route=>{
    sent=route.request().postDataJSON();
    await route.fulfill({json:{mode:'local',summary:'Discussed returning to work and support needs.',answer:'Draft summary',needs:['wellbeing','childcare'],nextSteps:['Check group opening times with the provider.'],citations:[{id:'grounded-service',name:'Confidence support',url:'https://example.org',excerpt:'Weekly confidence sessions.'}],services:[{id:'grounded-service',name:'Confidence support',provider:'Local charity'}],warnings:['This is a simulated meeting.']}});
  });
  await finishMeeting(page);
  const transcript='I want to get back into work. I also need childcare after school.';
  await expect(page.getByRole('heading',{name:'Draft meeting summary'})).toBeVisible();
  expect(sent).toEqual({task:'meeting',transcript,search:{area:'Bristol'}});
  await expect(page.getByText('Local directory draft',{exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Meeting summary'})).toContainText('Check group opening times');
  await page.getByText('Directory evidence',{exact:true}).click();
  await expect(page.getByRole('region',{name:'Meeting summary'}).getByRole('link',{name:'Confidence support'}).first()).toHaveAttribute('href','/#/directory/grounded-service');
  await page.getByRole('button',{name:'Staff demo',exact:true}).click();
  await expect(page.getByRole('region',{name:'Meeting summary'})).toHaveCount(0);
});

test('summary is scoped to the area chosen before the meeting',async({page})=>{
  let sent:Record<string,unknown>={};
  await page.route('**/api/assistant',async route=>{sent=route.request().postDataJSON();await route.fulfill({json:{mode:'local',summary:'Draft',answer:'',needs:[],nextSteps:[],citations:[],services:[],warnings:[]}});});
  await finishMeeting(page,'Kingston');
  await expect(page.getByRole('heading',{name:'Draft meeting summary'})).toBeVisible();
  expect(sent).toMatchObject({task:'meeting',search:{area:'Kingston'}});
});

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
  await expect(report.getByRole('button',{name:'Print or save as PDF'})).toBeInViewport();
  await expect(page.getByRole('tab',{name:'Summary'})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('region',{name:'Transcript'})).toHaveCount(0);
  await page.getByRole('tab',{name:'Transcript'}).click();
  await expect(page.getByRole('region',{name:'Transcript'})).toContainText('childcare after school');
  await page.getByRole('tab',{name:'Transcript'}).press('ArrowLeft');
  await expect(page.getByRole('tab',{name:'Summary'})).toBeFocused();
});
