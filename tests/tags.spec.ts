import { expect,test } from './fixtures';

test('staff can add, save and remove service tags without changing source information',async ({page,request})=>{
 const catalogue=await (await request.get('/api/imports?q=anxiety')).json();const id=catalogue.records[test.info().project.name.includes('mobile') ? 1 : 0].id;
 const originalResponse=await request.get(`/api/tags?serviceId=${encodeURIComponent(id)}`);expect(originalResponse.ok()).toBe(true);const original=await originalResponse.json();
 const sourceBefore=await (await request.get(`/api/imports/service?id=${encodeURIComponent(id)}`)).json();
 const tag=`Test tag ${test.info().project.name} ${Date.now()}`;
 try {
  await page.goto('/#/imports');await page.getByRole('button',{name:'Enter staff demo'}).click();await page.getByLabel('Search the full service text').fill('anxiety');await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator('.import-service-link').nth(test.info().project.name.includes('mobile') ? 1 : 0).click();
  const editor=page.getByRole('region',{name:'Service tags'});await expect(editor).toBeVisible();await editor.getByLabel('New tag').fill(tag);await editor.getByRole('button',{name:'Add tag',exact:true}).click();await editor.getByRole('button',{name:'Save tags',exact:true}).click();await expect(editor.getByRole('status')).toHaveText('Tags saved.');
  expect((await (await request.get(`/api/tags?serviceId=${encodeURIComponent(id)}`)).json()).tags).toContain(tag);
  await page.reload();await page.getByRole('button',{name:'Enter staff demo'}).click();await page.getByLabel('Search the full service text').fill('anxiety');await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator('.import-service-link').nth(test.info().project.name.includes('mobile') ? 1 : 0).click();await expect(editor.getByText(tag,{exact:true})).toBeVisible();await editor.getByRole('button',{name:`Remove tag ${tag}`,exact:true}).click();await editor.getByRole('button',{name:'Save tags',exact:true}).click();await expect(editor.getByRole('status')).toHaveText('Tags saved.');
  const sourceAfter=await (await request.get(`/api/imports/service?id=${encodeURIComponent(id)}`)).json();expect(sourceAfter.record.description).toEqual(sourceBefore.record.description);expect(sourceAfter.record.lastVerified).toEqual(sourceBefore.record.lastVerified);
 } finally {await request.post('/api/tags',{data:{serviceId:id,tags:original.tags}});}
});

test('tags API rejects invalid data, unknown records and cross-origin writes',async ({request})=>{
 const catalogue=await (await request.get('/api/imports')).json();const id=catalogue.records[0].id;
 const original=await (await request.get(`/api/tags?serviceId=${encodeURIComponent(id)}`)).json();
 expect((await request.post('/api/tags',{data:{serviceId:id,tags:['x'.repeat(41)]}})).status()).toBe(400);
 expect((await request.post('/api/tags',{data:{serviceId:'missing',tags:['Tag']}})).status()).toBe(404);
 expect((await request.post('/api/tags',{headers:{Origin:'https://example.com'},data:{serviceId:id,tags:['Tag']}})).status()).toBe(403);
 expect((await (await request.get(`/api/tags?serviceId=${encodeURIComponent(id)}`)).json()).tags).toEqual(original.tags);
});
