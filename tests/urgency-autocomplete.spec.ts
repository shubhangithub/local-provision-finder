import { expect, test } from './fixtures';
import { mockMicrophone, mockRealtime, service } from './meeting-helpers';
import { completeStaffSignIn } from './helpers/staff-sign-in';
import { chooseRegion } from './region-helpers';
const result={ready:true,total:2,page:1,pageSize:20,searchMode:'semantic',mappedCount:0,unmappedCount:2,mapRecords:[],records:[{...service('food-a','Food support'),urgentSupportEvidence:'Emergency food support.'},service('food-b','Community food parcels')]};
test('urgent wording activates help today; opt-out refreshes results',async({page})=>{
 const requests:string[]=[];
 await page.route('**/api/imports?**',route=>{requests.push(route.request().url());return route.fulfill({json:result});});
 await page.goto('/');await page.getByRole('combobox',{name:'What do you need help with?'}).fill('I have no food today');
 await expect(page.getByLabel('I need help today',{exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Find support',exact:true}).click();await chooseRegion(page,'Bristol');
 await expect(page.getByText('Urgent support listed',{exact:true})).toBeVisible();
 await expect(page.locator('.results-urgency').getByLabel('I need help today',{exact:true})).toBeVisible();
 await page.getByLabel('I need help today',{exact:true}).uncheck();
 await expect.poll(()=>requests.some(url=>url.includes('urgency=normal')&&url.includes('area=Bristol'))).toBe(true);
 await expect(page.getByText('Urgent support listed',{exact:true})).toHaveCount(0);
});
test('danger guidance appears without waiting for location or AI; negation does not trigger it',async({page})=>{
 await page.goto('/');const input=page.getByRole('combobox',{name:'What do you need help with?'});
 await input.fill('I cannot keep myself safe');await expect(page.getByRole('region',{name:'Immediate help'})).toBeVisible();await expect(page.getByRole('link',{name:'999',exact:true})).toHaveAttribute('href','tel:999');
 await input.fill('I do not want to hurt myself');await expect(page.getByRole('region',{name:'Immediate help'})).toHaveCount(0);await expect(page.getByLabel('I need help today',{exact:true})).not.toBeChecked();
});
test('suggestions are search terms, debounced, area-scoped and keyboard selectable',async({page})=>{
 const requests:string[]=[];
 await page.route('**/api/suggest?**',route=>{requests.push(route.request().url());return route.fulfill({json:{terms:['Food support','Food banks']}});});
 await page.goto('/');await chooseRegion(page,'Kingston');
 const input=page.getByRole('combobox',{name:'What do you need help with?'});await input.fill('f');await page.waitForTimeout(400);await expect(page.getByRole('listbox')).toHaveCount(0);expect(requests).toHaveLength(0);
 await input.fill('food');await expect(page.getByText('Suggested searches',{exact:true})).toBeVisible();await expect(page.getByText('Suggested services')).toHaveCount(0);await expect(page.getByRole('option',{name:'Food support',exact:true})).toBeVisible();expect(requests.some(url=>url.includes('q=food')&&url.includes('area=Kingston'))).toBe(true);
 await input.press('ArrowDown');await expect(input).toHaveAttribute('aria-activedescendant','support-option-0');await input.press('Enter');await expect(input).toHaveValue('Food support');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Support in Kingston upon Thames'})).toBeVisible();
 await input.fill('food again');await expect(page.getByRole('listbox')).toBeVisible();await input.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(input).toHaveValue('food again');
});
test('failed suggestions never block searching',async({page})=>{
 await page.route('**/api/suggest?**',route=>route.fulfill({status:500,json:{error:'no'}}));
 await page.goto('/');const input=page.getByRole('combobox',{name:'What do you need help with?'});await input.fill('housing');await page.waitForTimeout(500);await expect(page.getByRole('listbox')).toHaveCount(0);
 await page.getByRole('button',{name:'Find support',exact:true}).click();await expect(page.getByRole('heading',{name:/^Support in|Search results/})).toBeVisible();
});
test('live meeting urgency reorders relevant services and surfaces immediate help',async({page})=>{
 await mockMicrophone(page);await mockRealtime(page,{messages:[[50,{type:'transcript',itemId:'urgent',text:'I cannot keep myself safe. I need food.',final:true}],[80,{type:'concepts',concepts:[{label:'Food',query:'food',results:[service('normal','Routine food'),{...service('urgent','Emergency food'),urgentSupportEvidence:'Emergency food support.'}],filtered:{status:'done',ids:['normal','urgent'],ms:1}}]}]]});
 await page.goto('/');await page.getByRole('button',{name:'Staff sign in',exact:true}).click();await completeStaffSignIn(page);await page.getByRole('button',{name:'Start meeting',exact:true}).click();await page.getByRole('button',{name:'Start meeting',exact:true}).click();
 await expect(page.getByRole('region',{name:'Immediate help'})).toBeVisible();await expect(page.locator('.live-service h5').first()).toContainText('Emergency food');await expect(page.getByLabel('Prioritise help today')).toHaveCount(0);await page.getByRole('button',{name:'Stop meeting',exact:true}).click();
});
