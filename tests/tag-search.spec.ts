import { test, expect } from './fixtures';

test('staff tags rank first in both search modes and display safely on public cards', async ({ page, request }, testInfo) => {
  const catalogue = await (await request.get('/api/imports?area=Bristol&mode=keyword')).json();
  const service = catalogue.records[testInfo.project.name==='desktop' ? 17 : 18];
  const previous = await (await request.get('/api/tags', {params:{serviceId:service.id}})).json();
  const tag = `Tag QA ${testInfo.project.name} <b>`;
  try {
    const save = await request.post('/api/tags', {data:{serviceId:service.id,tags:[...previous.tags,tag]}});
    expect(save.ok()).toBe(true);
    for (const mode of ['keyword','semantic']) {
      const response = await request.get('/api/imports', {params:{q:tag,area:'Bristol',mode}});
      expect(response.ok()).toBe(true);
      const results = await response.json();
      expect(results.records[0].id).toBe(service.id);
      expect(results.records[0].tags).toContain(tag);
    }
    await page.goto('/');
    await page.getByLabel('What do you need help with?', {exact:true}).fill(tag);
    await page.getByRole('button', {name:/^Location /}).click();
    await page.locator('#location-query').fill('Bristol');await page.getByRole('button',{name:'Search this area',exact:true}).click();
    const first = page.locator('.directory-results-list .service-card').first();
    await expect(first.locator('.import-service-link')).toHaveText(service.name);
    await expect(first.locator('.directory-result-tags li').filter({hasText:tag})).toHaveText(tag);
    await expect(first.locator('.directory-result-tags b')).toHaveCount(0);
  } finally {
    const restore = await request.post('/api/tags', {data:{serviceId:service.id,tags:previous.tags}});
    expect(restore.ok()).toBe(true);
  }
});
