import {expect,test} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';

test('a visitor suggestion becomes a checked staff draft and searchable service',async({page,request})=>{
 const name=`Community workflow test ${test.info().project.name} ${Date.now()}`;let id:string|undefined;let serviceId:string|undefined;
 try {
  await page.goto('/#/suggest');await page.getByLabel('Service name',{exact:true}).fill(name);await page.getByLabel('Organisation or provider').fill('Community Test Charity');await page.getByLabel('What support does it offer?').fill('Evening anxiety support, quiet rooms and funded travel.');await page.getByLabel('Public phone number').fill('020 1234 5678');await page.getByLabel('Postcode (optional)',{exact:true}).fill('KT1 1AA');await page.getByRole('button',{name:'Send suggestion'}).click();await expect(page.getByRole('heading',{name:'Service suggestion received'})).toBeVisible();
  const entries=(await(await request.get('/api/suggestions')).json()).entries;id=entries.find((entry:{fields:{name:string}})=>entry.fields.name===name).id;
  await page.goto('/#/suggestions');await page.getByRole('button',{name:'Enter staff demo'}).click();const card=page.locator('.review-card').filter({has:page.getByRole('heading',{name,exact:true})});await card.getByRole('button',{name:'Review suggestion'}).click();await page.getByRole('button',{name:'Prepare and fetch draft'}).click();await expect(page.getByRole('heading',{name:'Draft ready for checking'})).toBeVisible();await expect(page.getByRole('button',{name:'Publish checked service'})).toBeDisabled();await page.getByLabel('Evidence and review note').fill('Provider confirmed service details and published contact number.');await page.getByLabel('I checked the source and confirm these service details can be published.').check();await page.getByRole('button',{name:'Publish checked service'}).click();await expect(page.locator('.suggestion-confirmation')).toHaveText('Service published to search.');
  const published=(await(await request.get('/api/suggestions')).json()).entries.find((entry:{id:string})=>entry.id===id);serviceId=published.serviceId;expect(published.status).toBe('published');const service=await(await request.get(`/api/imports/service?id=${encodeURIComponent(serviceId!)}`)).json();expect(service.record.name).toBe(name);expect(service.record.publicPhone).toBe('020 1234 5678');expect(service.record.lastVerified).toBeNull();const found=await(await request.get(`/api/imports?q=${encodeURIComponent(name)}`)).json();expect(found.records.some((record:{id:string})=>record.id===serviceId)).toBe(true);
 }finally{
  if(id){const queue=new DatabaseSync(resolve('data/suggestions.sqlite'));queue.exec('PRAGMA busy_timeout=5000');const row=queue.prepare('SELECT entry_json FROM suggestions WHERE id=?').get(id);if(row)serviceId=JSON.parse(String(row.entry_json)).serviceId;queue.prepare('DELETE FROM suggestions WHERE id=?').run(id);queue.close();}
  if(serviceId){const db=new DatabaseSync(resolve('data/services.sqlite'));db.exec('PRAGMA busy_timeout=5000');db.exec('BEGIN IMMEDIATE');for(const table of ['services','catalogue_services'])db.prepare(`DELETE FROM ${table} WHERE id=?`).run(serviceId);db.prepare('DELETE FROM service_needs WHERE service_id=?').run(serviceId);db.exec('COMMIT');db.close();}
 }
});

test('suggestion API requires contact evidence and rejects cross-origin writes',async({request})=>{
 expect((await request.post('/api/suggestions',{data:{name:'Charity',provider:'Provider',description:'Support'}})).status()).toBe(400);
 expect((await request.post('/api/suggestions',{headers:{Origin:'https://example.com'},data:{name:'Charity',provider:'Provider',description:'Support',phone:'02012345678'}})).status()).toBe(403);
 expect((await request.post('/api/suggestions/prepare',{data:{id:'missing'}})).status()).toBe(404);
});
