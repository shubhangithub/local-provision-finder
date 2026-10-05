import {completeStaffSignIn} from './helpers/staff-sign-in';
import {expect,test} from './fixtures';
test('staff sees web discovery provenance and queue refreshes on discovery',async({page})=>{
 const entry={id:'mock-discovery',status:'draft',fields:{name:'Found service',provider:'Community provider',description:'Local support',website:'https://example.org/service',phone:'',email:'',address:'',postcode:'',cost:''},draft:{searchText:'Source text',sourceFetchStatus:'Fetched public source',discovery:{query:'Evening help',area:'Kingston',sourceUrls:['https://example.org/service','javascript:alert(1)']}},reviewNote:null,serviceId:null};let found=false;
 await page.route('**/api/suggestions',async route=>{await route.fulfill({json:{entries:found?[entry]:[]}});});
 await page.goto('/#/suggestions');await page.getByRole('button',{name:'Enter staff demo'}).click();await completeStaffSignIn(page);await expect(page.getByRole('heading',{name:'No listings waiting'})).toBeVisible();
 found=true;await page.evaluate(()=>window.dispatchEvent(new Event('suggestions-updated')));await page.getByRole('button',{name:'Review suggestion'}).click();
 await expect(page.getByText('Found through a search',{exact:true})).toBeVisible();await expect(page.getByText('Evening help · Kingston')).toBeVisible();await expect(page.getByRole('link',{name:'https://example.org/service',exact:true})).toHaveAttribute('href','https://example.org/service');await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);await expect(page.getByRole('button',{name:'Publish checked service'})).toBeDisabled();
});
