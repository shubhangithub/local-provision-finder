import { expect, test } from './fixtures';

async function finishMeeting(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>{}}]})}});
    class Recorder {state='inactive';mimeType='audio/webm';start(){this.state='recording';}stop(){this.state='inactive';}}
    Object.defineProperty(window,'MediaRecorder',{configurable:true,value:Recorder});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Staff sign in',exact:true}).click();
  await page.getByRole('button',{name:'Start meeting',exact:true}).click();
  await expect(page.getByRole('region',{name:'Simulated transcript'})).toContainText('Thanks for coming');
  await page.getByRole('button',{name:'Stop meeting',exact:true}).click();
}

test('staff summarises only the displayed transcript and gets grounded service links',async({page})=>{
  let sent:Record<string,unknown>={};
  await page.route('**/api/assistant',async route=>{
    sent=route.request().postDataJSON();
    await route.fulfill({json:{mode:'local',summary:'Discussed returning to work and support needs.',answer:'Draft summary',needs:['wellbeing','childcare'],nextSteps:['Check group opening times with the provider.'],citations:[{id:'grounded-service',name:'Confidence support',url:'https://example.org',excerpt:'Weekly confidence sessions.'}],services:[{id:'grounded-service',name:'Confidence support',provider:'Local charity'}],warnings:['This is a simulated meeting.']}});
  });
  await finishMeeting(page);
  const transcript=await page.getByRole('region',{name:'Simulated transcript'}).innerText();
  await page.getByRole('button',{name:'Summarise meeting',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Draft meeting summary'})).toBeVisible();
  expect(sent).toEqual({task:'meeting',transcript,search:{area:'Bristol'}});
  await expect(page.getByText('Local directory draft',{exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Meeting summary'})).toContainText('Check group opening times');
  await expect(page.getByRole('region',{name:'Meeting summary'}).getByRole('link',{name:'Confidence support'}).first()).toHaveAttribute('href','/#/directory/grounded-service');
  await page.getByLabel('Find support in',{exact:true}).selectOption('Kingston');
  await expect(page.getByRole('region',{name:'Meeting summary'})).toHaveCount(0);
  await page.getByRole('button',{name:'Summarise meeting',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Draft meeting summary'})).toBeVisible();
  expect(sent).toEqual({task:'meeting',transcript,search:{area:'Kingston'}});
  await page.getByRole('button',{name:'Staff demo',exact:true}).click();
  await expect(page.getByRole('region',{name:'Meeting summary'})).toHaveCount(0);
});

test('summary failure allows staff to retry',async({page})=>{
  await page.route('**/api/assistant',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
  await finishMeeting(page);
  await page.getByRole('button',{name:'Summarise meeting',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Unavailable');
  await expect(page.getByRole('button',{name:'Summarise meeting',exact:true})).toBeEnabled();
});
