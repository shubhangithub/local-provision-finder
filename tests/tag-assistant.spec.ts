import {expect,test} from './fixtures';
test('suggested staff tags require explicit addition and saving',async({page})=>{
 let saves=0;let assistanceCalls=0;
 await page.route('**/api/tags**',async route=>{if(route.request().method()==='POST')saves++;await route.fulfill({json:{tags:[]}});});
 await page.route('**/api/assistant',async route=>{const input=route.request().postDataJSON();expect(input.task).toBe('tags');expect(input.serviceId).toBeTruthy();expect(route.request().headers()['x-staff-demo']).toBe('true');assistanceCalls++;await route.fulfill({json:{mode:'local',summary:'Suggested labels',answer:'Consider these labels from the service description.',needs:[],nextSteps:[],services:[],citations:[{id:input.serviceId,name:'Service evidence',url:'https://example.org/service',excerpt:'Anxiety support.'}],warnings:[],suggestedTags:['Anxiety support']}});});
 await page.goto('/#/imports');await page.getByRole('button',{name:'Enter staff demo'}).click();await page.getByLabel('Search the full service text').fill('anxiety');await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator('.import-service-link').first().click();
 const editor=page.getByRole('region',{name:'Service tags'});await expect(editor.getByRole('button',{name:'Save tags',exact:true})).toBeDisabled();
 await editor.getByRole('button',{name:'Suggest tags',exact:true}).click();await expect(editor.getByRole('button',{name:'Add suggested tag Anxiety support',exact:true})).toBeVisible();expect(assistanceCalls).toBe(1);expect(saves).toBe(0);
 await editor.getByRole('button',{name:'Add suggested tag Anxiety support',exact:true}).click();await expect(editor.getByRole('button',{name:'Save tags',exact:true})).toBeEnabled();expect(saves).toBe(0);
 await editor.getByRole('button',{name:'Save tags',exact:true}).click();await expect(editor.getByRole('status')).toHaveText('Tags saved.');expect(saves).toBe(1);
});
