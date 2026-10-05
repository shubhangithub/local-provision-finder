import {test,expect} from '@playwright/test';
import { chooseRegion } from './region-helpers';
for(const found of [true,false])test(`empty directory triggers agent, web providers found=${found}`,async({page})=>{
 let calls=0;
 await page.route('**/api/imports?**',route=>route.fulfill({json:{total:0,records:[],mapRecords:[],searchMode:'semantic'}}));
 await page.route('**/api/assistant',async route=>{calls++;const body=route.request().postDataJSON();expect(body.search.q).toBe('wheelchair dance');expect(body.search.area).toBe('Bristol');await new Promise(resolve=>setTimeout(resolve,400));await route.fulfill({json:{mode:'openai',summary:'Search completed',answer:'Search completed',needs:[],nextSteps:[],citations:[],warnings:[],discoveries:found?[{suggestionId:'test',name:'Community dance',provider:'Dance provider',description:'Accessible sessions',url:'https://example.org/dance',reviewStatus:'pending',scope:'local',providerType:'community'}]:[]}});});
 await page.goto('/');await page.getByLabel('What do you need help with?',{exact:true}).fill('wheelchair dance');await chooseRegion(page,'Bristol');
 await expect(page.getByText('Finding support and checking relevant sources…')).toBeVisible();await expect(page.getByRole('heading',{name:'No matching services'})).toHaveCount(0);
 if(found){await expect(page.getByRole('link',{name:'Community dance'})).toBeVisible();await expect(page.getByText('Provisional · Not yet reviewed · Local support',{exact:true})).toBeVisible();await expect(page.getByText(/These listings were found by AI/)).toBeVisible();await expect(page.getByText('Sent to staff for review.')).toBeVisible();await expect(page.getByRole('heading',{name:'No matching services'})).toHaveCount(0);}else await expect(page.getByText('The agent also found no suitable providers online. Try different words or another area.')).toBeVisible();
 expect(calls).toBe(1);
});

test('provisional local and national suggestions show their coverage and original sources',async({page})=>{
 await page.route('**/api/imports?**',route=>route.fulfill({json:{total:0,records:[],mapRecords:[],searchMode:'semantic'}}));
 await page.route('**/api/assistant',route=>route.fulfill({json:{mode:'openai',summary:'Practical support found online',answer:'',citations:[],warnings:[],needs:[],nextSteps:[],discoveries:[{suggestionId:'local',name:'Local public access route',provider:'NHS service',description:'Referral advice.',url:'https://example.org/nhs',scope:'local',providerType:'public',reviewStatus:'pending'},{suggestionId:'national',name:'National charity support',provider:'Charity',description:'National advice.',url:'https://example.org/charity',scope:'national',providerType:'charity',reviewStatus:'pending'}]}}));
 await page.goto('/');await page.getByLabel('What do you need help with?',{exact:true}).fill('prosthetic limb fitting');await chooseRegion(page,'Kingston');
 await expect(page.getByText('Provisional · Not yet reviewed · Local support',{exact:true})).toBeVisible();await expect(page.getByText('Provisional · Not yet reviewed · National support',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'National charity support',exact:true})).toHaveAttribute('href','https://example.org/charity');
});
