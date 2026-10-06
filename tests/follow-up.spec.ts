import AxeBuilder from '@axe-core/playwright';
import { DatabaseSync } from 'node:sqlite';
import { completeStaffSignIn } from './helpers/staff-sign-in';
import { test,expect,type APIRequestContext } from './fixtures';

// These tests create real reports with follow-up consent and look for the first one in the queue, so they run one at a time.
test.describe.configure({mode:'serial'});
const wcag=['wcag2a','wcag2aa','wcag21a','wcag21aa'];
const number='07700 900123';
const cleanup=(ids:string[])=>{
  const feedback=new DatabaseSync('data/feedback.sqlite');const follow=new DatabaseSync('data/follow-ups.sqlite');
  for (const id of ids) {feedback.prepare('DELETE FROM feedback WHERE id=?').run(id);follow.prepare('DELETE FROM follow_ups WHERE feedback_id=?').run(id);}
  feedback.close();follow.close();
};
async function firstService(request:APIRequestContext) {return (await (await request.get('/api/imports?area=Kingston')).json()).records[0] as {id:string;name:string};}
async function submit(request:APIRequestContext,serviceId:string,note:string,followUp?:unknown) {
  const response=await request.post('/api/feedback',{data:{serviceId,answers:{upToDate:'yes',issues:[]},note,...(followUp===undefined ? {} : {followUp})}});
  return {response,entry:(await response.json()).entry as {id:string}|undefined};
}

test('a person can ask for a follow-up call on the feedback form, and the number never appears in the feedback list',async({page,request},testInfo)=>{
  const service=await firstService(request);const note=`Follow-up consent check ${testInfo.project.name} ${Date.now()}`;let id:string|undefined;
  try {
    await page.goto(`/#/directory/${encodeURIComponent(service.id)}`);
    await page.getByRole('button',{name:'Give feedback',exact:true}).click();
    await page.getByLabel('Yes',{exact:true}).first().check();
    await expect(page.getByLabel('Phone number to call')).toHaveCount(0);
    await page.getByLabel('Call me in about a week to ask how it went (optional)').check();
    await expect(page.getByText('Demo: no real call is made yet.')).toBeVisible();
    await page.getByLabel('Anything else we should check? (optional)').fill(note);
    expect((await new AxeBuilder({page}).withTags(wcag).analyze()).violations).toEqual([]);
    await page.getByRole('button',{name:'Send feedback',exact:true}).click();
    await expect(page.getByText('Phone number to call')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Enter a phone number');
    await page.getByLabel('Phone number to call').fill(number);
    await page.getByRole('button',{name:'Send feedback',exact:true}).click();
    await expect(page.getByText('Thank you. Your feedback is in the review queue.')).toBeVisible();
    await expect(page.getByText('You asked for a follow-up call in about a week')).toBeVisible();
    const text=await (await request.get('/api/feedback')).text();
    id=(JSON.parse(text).entries as {id:string;note:string}[]).find(entry=>entry.note===note)!.id;
    expect(text).not.toContain('07700');expect(text).not.toContain('900123');
    const stored=new DatabaseSync('data/follow-ups.sqlite',{readOnly:true});
    expect(stored.prepare('SELECT phone,status FROM follow_ups WHERE feedback_id=?').get(id)).toMatchObject({phone:'07700900123',status:'scheduled'});stored.close();
  } finally {if (id) cleanup([id]);}
});

test('feedback with a number but no consent is rejected and stores nothing; feedback without follow-up still works',async({request},testInfo)=>{
  const service=await firstService(request);const ids:string[]=[];
  try {
    const marker=`no consent ${testInfo.project.name} ${Date.now()}`;
    const refused=await submit(request,service.id,marker,{phone:number});
    expect(refused.response.status()).toBe(400);expect((await refused.response.json()).error).toMatch(/Tick the box/);
    expect((await (await request.get('/api/feedback')).json()).entries.some((entry:{note:string})=>entry.note===marker)).toBe(false);
    const plain=await submit(request,service.id,`no follow-up ${testInfo.project.name} ${Date.now()}`);expect(plain.response.status()).toBe(201);ids.push(plain.entry!.id);
    expect((await plain.response.json()).followUp).toBe(false);
  } finally {cleanup(ids);}
});

test('staff see the follow-up status on a report, place the sandbox call, and the outcome shows; reports without consent have none',async({page,request},testInfo)=>{
  test.setTimeout(20_000);
  const service=await firstService(request);const stamp=Date.now();const ids:string[]=[];
  try {
    const consenting=await submit(request,service.id,`Follow-up review ${testInfo.project.name} ${stamp}`,{phone:number,consent:true});ids.push(consenting.entry!.id);
    const plain=await submit(request,service.id,`Plain report ${testInfo.project.name} ${stamp}`);ids.push(plain.entry!.id);
    let followUp:Record<string,unknown>={status:'scheduled',outcome:null,reason:null,reportIds:[]};let placed=0;
    await page.route(url=>url.pathname==='/api/follow-ups',async route=>{
      const feedbackId=new URL(route.request().url()).searchParams.get('feedbackId');
      if (route.request().method()==='POST') {expect(route.request().postDataJSON().feedbackId).toBe(consenting.entry!.id);placed++;followUp={status:'requested',outcome:null,reason:null,reportIds:[]};return route.fulfill({status:202,json:{sandbox:true,followUp}});}
      if (feedbackId===consenting.entry!.id) return route.fulfill({json:{configured:true,sandbox:true,followUp}});
      // Any other report in the shared data (including leftovers) has no follow-up as far as this test is concerned.
      return route.fulfill({status:404,json:{error:'No follow-up for this report.'}});
    });
    await page.goto('/#/feedback');
    await page.getByRole('button',{name:'Enter staff workspace'}).click();await completeStaffSignIn(page);
    await expect(page.getByRole('heading',{name:'Review service feedback'})).toBeVisible();
    // Only the report that gave consent has a follow-up panel; the plain report is listed without one.
    const cards=page.locator('.report-row').filter({has:page.getByRole('region',{name:'Follow-up call'})});
    await expect(cards).toHaveCount(1);expect(await page.locator('.report-row').count()).toBeGreaterThan(1);
    await expect(cards.getByText('Follow-up scheduled in 1 week')).toBeVisible();
    await expect(cards.getByText('Sandbox demo')).toBeVisible();
    await cards.first().getByRole('button',{name:'Follow up now'}).click();
    await expect(cards.first().getByRole('status')).toHaveText('Follow-up call in progress…');expect(placed).toBe(1);
    followUp={status:'completed',outcome:'answered',reason:null,reportIds:['new-report-1']};
    await expect(cards.first().getByText(/Follow-up complete\. Person answered\. 1 change to review\./)).toBeVisible({timeout:6000});
    await expect(cards.first().getByRole('button',{name:'Follow up now'})).toHaveCount(0);
    expect((await new AxeBuilder({page}).withTags(wcag).analyze()).violations).toEqual([]);
  } finally {cleanup(ids);}
});

test('a refused follow-up shows the reason and can be tried again; unconfigured shows why it is disabled',async({page,request},testInfo)=>{
  const service=await firstService(request);const ids:string[]=[];
  try {
    const entry=(await submit(request,service.id,`Refused follow-up ${testInfo.project.name} ${Date.now()}`,{phone:number,consent:true})).entry!;ids.push(entry.id);
    // The real server may or may not have gov-hack configured, so state "not configured" explicitly.
    // Other reports in the shared data (including leftovers) have no follow-up as far as this test is concerned.
    await page.route(url=>url.pathname==='/api/follow-ups',route=>route.fulfill(new URL(route.request().url()).searchParams.get('feedbackId')===entry.id ? {json:{configured:false,sandbox:true,followUp:{status:'scheduled',outcome:null,reason:null,reportIds:[]}}} : {status:404,json:{error:'none'}}));
    await page.goto('/#/feedback');await page.getByRole('button',{name:'Enter staff workspace'}).click();await completeStaffSignIn(page);
    const panel=page.getByRole('region',{name:'Follow-up call'}).first();
    await expect(panel.getByText('Follow-up scheduled in 1 week')).toBeVisible();
    await expect(panel.getByRole('button',{name:'Follow up now'})).toBeDisabled();
    await expect(panel.getByText(/Not configured/)).toBeVisible();
    await page.unroute(url=>url.pathname==='/api/follow-ups');
    await page.route(url=>url.pathname==='/api/follow-ups',route=>route.fulfill(new URL(route.request().url()).searchParams.get('feedbackId')!==entry.id ? {status:404,json:{error:'none'}} : {json:{configured:true,sandbox:true,followUp:{status:'denied',outcome:null,reason:'Outside calling hours (09:00 to 17:00 UK time).',reportIds:[]}}}));
    await page.reload();if (await page.getByRole('button',{name:'Enter staff workspace'}).isVisible()) {await page.getByRole('button',{name:'Enter staff workspace'}).click();await completeStaffSignIn(page);}
    const again=page.getByRole('region',{name:'Follow-up call'}).first();
    await expect(again.getByText('Follow-up did not go ahead: Outside calling hours (09:00 to 17:00 UK time).')).toBeVisible();
    await expect(again.getByRole('button',{name:'Try again'})).toBeEnabled();
  } finally {cleanup(ids);}
});

test('a call finding is applied in one click, and dismissed in one click',async({page,request},testInfo)=>{
  test.setTimeout(20_000);
  const catalogue=await (await request.get('/api/imports?area=Kingston')).json();
  const service=catalogue.records[2] as {id:string;name:string};const stamp=`${testInfo.project.name} ${Date.now()}`;const ids:string[]=[];
  const original=(await (await request.get(`/api/imports/service?id=${encodeURIComponent(service.id)}`)).json()).record;
  const db=new DatabaseSync('data/feedback.sqlite');
  const insert=(id:string,note:string,proposed:Record<string,unknown>)=>{
    const entry={id,serviceId:service.id,serviceName:service.name,createdAt:new Date().toISOString(),status:'pending',answers:{upToDate:'changed',issues:['cost']},note,proposed};
    db.prepare('INSERT INTO feedback VALUES(?,?,?)').run(id,service.id,JSON.stringify(entry));ids.push(id);
  };
  const applied=`Twelve pounds a session ${Date.now()}`;
  insert(`apply-${stamp}`,`apply ${stamp}`,{field:'cost',value:applied,previous:original.cost??'',quote:'It is twelve pounds a session now.',source:'follow-up'});
  insert(`dismiss-${stamp}`,`dismiss ${stamp}`,{field:'cost',value:'Never applied',previous:'',quote:'Not sure about this.',source:'follow-up'});
  try {
    await page.goto('/#/feedback');await page.getByRole('button',{name:'Enter staff workspace'}).click();await completeStaffSignIn(page);
    const rows=page.locator('.report-row').filter({hasText:service.name});
    await expect(rows.filter({hasText:applied})).toContainText('It is twelve pounds a session now.');
    await expect(rows.filter({hasText:'Never applied'}).getByRole('button',{name:'Apply'})).toBeVisible();
    expect((await new AxeBuilder({page}).withTags(wcag).analyze()).violations).toEqual([]);
    await rows.filter({hasText:applied}).getByRole('button',{name:/^Apply/}).click();
    await expect(page.getByText(`Cost updated for ${service.name}.`)).toBeVisible();await expect(rows.filter({hasText:applied})).toHaveCount(0);
    expect((await (await request.get(`/api/imports/service?id=${encodeURIComponent(service.id)}`)).json()).record.cost).toBe(applied);
    await rows.filter({hasText:'Never applied'}).getByRole('button',{name:'Dismiss'}).click();
    await expect(page.getByText('Report dismissed.')).toBeVisible();await expect(rows.filter({hasText:'Never applied'})).toHaveCount(0);
    expect((await (await request.get(`/api/imports/service?id=${encodeURIComponent(service.id)}`)).json()).record.cost).toBe(applied);
    const entries=(await (await request.get('/api/feedback')).json()).entries as {id:string;status:string;review?:{note:string}}[];
    expect(entries.find(entry=>entry.id===`apply-${stamp}`)).toMatchObject({status:'resolved',review:{note:expect.stringContaining('Confirmed on a follow-up call')}});
    expect(entries.find(entry=>entry.id===`dismiss-${stamp}`)?.status).toBe('dismissed');
  } finally {
    for (const id of ids) {db.prepare('DELETE FROM corrections WHERE feedback_id=?').run(id);db.prepare('DELETE FROM feedback WHERE id=?').run(id);}
    db.close();
  }
});
