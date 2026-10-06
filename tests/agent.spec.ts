import {completeStaffSignIn} from './helpers/staff-sign-in';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
// Keep UI checks independent of generated wording and external model availability.
test.beforeEach(async({page})=>{
 await page.route('**/api/assistant',async route=>{
  const input=route.request().postDataJSON();
  if(input.task==='search')return route.fulfill({json:{mode:'local',citations:[]}});
  if(input.task==='service'){
   const response=await page.request.get(`/api/imports/service?id=${encodeURIComponent(input.serviceId)}`);
   const {record}=await response.json();
   return route.fulfill({json:{mode:'openai',answer:`Who it is for: ${record.eligibilitySummary||record.description||record.name}`,citations:[]}});
  }
  return route.fulfill({json:{mode:'openai',answer:input.pageContext,citations:[]}});
 });
});
test('agent is available across routes, uses record context, and returns directory provision', async ({page},testInfo)=>{
  await page.goto('/');
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Ask agent',exact:true}).click();
  const agent=page.getByRole('complementary',{name:'Directory agent'});
  await expect(agent).toBeVisible();
  await agent.getByLabel('Ask the agent',{exact:true}).fill('Find support for anxiety in Bristol');
  await agent.getByRole('button',{name:'Ask agent',exact:true}).click();
  await expect(agent.locator('.agent-result').first()).toBeVisible({timeout:15000});
  await expect(agent.getByRole('log')).toContainText('Matching directory services are listed below.');
  const result=agent.locator('.agent-result').first();
  const serviceName=await result.locator('h3').innerText();
  await page.screenshot({path:testInfo.outputPath('directory-agent.png'),fullPage:true});
  const violations=(await new AxeBuilder({page}).include('.directory-agent').analyze()).violations;
  expect(violations).toEqual([]);
  await result.locator('h3').getByRole('button').click();
  await expect(page).toHaveURL(/#\/directory\//);
  await expect(page.getByRole('heading',{name:serviceName,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ask agent about this service',exact:true}).click();
  await expect(agent.locator('.agent-page-context')).toContainText(serviceName);
  await expect(agent.getByRole('log')).toContainText('Who it is for:');
  await agent.getByRole('button',{name:'Close agent',exact:true}).click();
  await page.getByRole('button',{name:'Staff sign in',exact:true}).click();await completeStaffSignIn(page);
  await page.evaluate(()=>{location.hash='/review';});
  await page.locator('.review-card').first().getByRole('button',{name:'Generate AI review',exact:true}).click();
  await page.locator('.review-card').first().getByRole('button',{name:'Ask agent about this item',exact:true}).click();
  await expect(agent.getByRole('log')).toContainText('Closure:');
  await page.keyboard.press('Escape');
  await expect(agent).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test.fixme('agent summary review reflects edits and exports remain separate from guidance',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}});
    class Recorder {state='inactive';mimeType='audio/webm';onstop:(()=>void)|null=null;ondataavailable:((event:{data:Blob})=>void)|null=null;start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();}}
    Object.defineProperty(window,'MediaRecorder',{configurable:true,value:Recorder});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Staff sign in',exact:true}).click();await completeStaffSignIn(page);
  await page.getByRole('button', { name: /^Staff/ }).click();
  await page.getByRole('link', { name: 'Start meeting', exact: true }).click();
  await page.getByLabel('Add conversation note').fill('I need help finding work.');
  await page.getByRole('button',{name:'Add note',exact:true}).click();
  await page.getByRole('button',{name:'Stop meeting',exact:true}).click();
  await page.getByRole('button',{name:'Produce customer summary',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Customer meeting summary',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Prepare the customer’s plan'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Agent summary review'})).toContainText('Add the customer’s name');
  await expect(page.getByRole('region',{name:'Agent summary review'})).toContainText('target date');
  await page.getByRole('button',{name:'Ask agent to review this summary',exact:true}).click();
  const agent=page.getByRole('complementary',{name:'Directory agent'});
  await expect(agent.getByRole('log')).toContainText('Add the customer’s name');
  await agent.getByRole('button',{name:'Close agent',exact:true}).click();
  await page.getByLabel('Prepared for',{exact:true}).fill('Alex');
  await expect(page.getByRole('region',{name:'Agent summary review'})).not.toContainText('Add the customer’s name');
  await page.getByRole('button',{name:'Ask agent to review this summary',exact:true}).click();
  await expect(agent.locator('.agent-message.agent').last()).not.toContainText('Add the customer’s name');
  await agent.getByRole('button',{name:'Close agent',exact:true}).click();
  await page.getByRole('button',{name:'Save as PDF',exact:true}).click();
  await expect(page.locator('.toast')).toContainText('PDF downloaded.');
});
