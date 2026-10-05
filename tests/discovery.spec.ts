import {test,expect} from '@playwright/test';
for(const found of [true,false])test(`empty directory triggers agent, web providers found=${found}`,async({page})=>{
 let calls=0;
 await page.route('**/api/imports?**',route=>route.fulfill({json:{total:0,records:[],mapRecords:[],searchMode:'semantic'}}));
 await page.route('**/api/assistant',async route=>{calls++;const body=route.request().postDataJSON();expect(body.search.q).toBe('wheelchair dance');expect(body.search.area).toBe('Bristol');await new Promise(resolve=>setTimeout(resolve,400));await route.fulfill({json:{mode:'openai',summary:'Search completed',answer:'Search completed',needs:[],nextSteps:[],citations:[],warnings:[],discoveries:found?[{suggestionId:'test',name:'Community dance',provider:'Dance provider',description:'Accessible sessions',url:'https://example.org/dance',reviewStatus:'pending'}]:[]}});});
 await page.goto('/');await page.getByLabel('What do you need help with?',{exact:true}).fill('wheelchair dance');await page.getByRole('button',{name:'Location Choose an area or use your location'}).click();await page.getByLabel('Town or service postcode').fill('Bristol');await page.getByRole('button',{name:'Search this area',exact:true}).click();
 await expect(page.getByText('Finding support and checking relevant sources…')).toBeVisible();await expect(page.getByRole('heading',{name:'No matching services'})).toHaveCount(0);
 if(found){await expect(page.getByRole('link',{name:'Community dance'})).toBeVisible();await expect(page.getByText('Not yet reviewed',{exact:true})).toBeVisible();await expect(page.getByText(/These listings were found by AI/)).toBeVisible();await expect(page.getByText('Sent to staff for review.')).toBeVisible();await expect(page.getByRole('heading',{name:'No matching services'})).toHaveCount(0);}else await expect(page.getByText('The agent also found no suitable providers online. Try different words or another area.')).toBeVisible();
 expect(calls).toBe(1);
});
