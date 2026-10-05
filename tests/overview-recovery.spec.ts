import { expect, test } from './fixtures';
const catalogue={total:1,page:1,pageSize:20,ready:true,searchMode:'semantic',mapRecords:[],mappedCount:0,unmappedCount:1,records:[{id:'test',name:'Community support',provider:'Charity',postcode:null,distanceMiles:null,sites:[],snippet:'Support',tags:[]}]};
const answer=(summary:string)=>({mode:'openai',summary,answer:summary,needs:[],nextSteps:[],citations:[{id:'test',name:'Community support',excerpt:'Recorded support.'}],services:[],warnings:[]});
async function search(page:import('@playwright/test').Page){
 await page.route('**/api/imports?**',route=>route.fulfill({json:catalogue}));await page.goto('/');await page.getByLabel('What do you need help with?',{exact:true}).fill('help finding work');await page.getByRole('button',{name:'Location Choose an area or use your location'}).click();await page.getByLabel('Town or service postcode').fill('Bristol');await page.getByRole('button',{name:'Search this area',exact:true}).click();
}
test('a slow first overview survives catalogue refreshes and view rerenders with one request',async({page})=>{
 let calls=0;await page.route('**/api/assistant',async route=>{calls++;await new Promise(resolve=>setTimeout(resolve,900));await route.fulfill({json:answer('First overview completed.')});});
 await search(page);await expect(page.locator('.assistant-spinner')).toBeVisible();await page.evaluate(()=>window.dispatchEvent(new Event('directory-updated')));await page.getByRole('button',{name:'Map',exact:true}).click();await expect(page.getByText('First overview completed.',{exact:true})).toBeVisible();expect(calls).toBe(1);
 await page.getByLabel('What do you need help with?',{exact:true}).fill('childcare');await page.getByRole('button',{name:'Find support',exact:true}).click();await expect.poll(()=>calls).toBe(2);await expect(page.getByText('First overview completed.',{exact:true})).toBeVisible();
});
test('a temporary first request failure recovers automatically without a retry click',async({page})=>{
 let calls=0;await page.route('**/api/assistant',route=>{calls++;return calls===1?route.fulfill({status:503,json:{error:'Temporary failure'}}):route.fulfill({json:answer('Recovered automatically.')});});
 await search(page);await expect(page.getByText('Recovered automatically.',{exact:true})).toBeVisible();expect(calls).toBe(2);await expect(page.getByRole('button',{name:'Retry agent search',exact:true})).toHaveCount(0);
});
test('persistent failure is bounded and a deliberate retry remains available',async({page})=>{
 let calls=0;await page.route('**/api/assistant',route=>{calls++;return route.fulfill({status:503,json:{error:'Temporary failure'}});});await search(page);await expect(page.getByRole('alert')).toHaveText('Temporary failure');expect(calls).toBe(2);
 await page.route('**/api/assistant',route=>route.fulfill({json:answer('Manual retry completed.')}));await page.getByRole('button',{name:'Retry agent search',exact:true}).click();await expect(page.getByText('Manual retry completed.',{exact:true})).toBeVisible();
});
test('validation failures are not retried automatically',async({page})=>{
 let calls=0;await page.route('**/api/assistant',route=>{calls++;return route.fulfill({status:400,json:{error:'Check the search area.'}});});await search(page);await expect(page.getByRole('alert')).toHaveText('Check the search area.');expect(calls).toBe(1);
});
