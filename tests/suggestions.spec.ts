import {test,expect} from '@playwright/test';
import {completeStaffSignIn} from './helpers/staff-sign-in';
test('customer can suggest a resource and staff can find it for review',async({page})=>{
 let entry:unknown;
 await page.route('**/api/suggestions',async route=>{
  if(route.request().method()==='POST'){
   entry={id:'customer-resource',status:'submitted',fields:route.request().postDataJSON(),draft:null};
   await route.fulfill({status:201,json:{entry}});
  }else await route.fulfill({json:{entries:entry?[entry]:[]}});
 });
 await page.goto('/');
 await page.getByRole('link',{name:'Suggest a provision or resource'}).click();
 await page.getByLabel('Provision or resource name').fill('Benefits guide');
 await page.getByLabel('Organisation or provider').fill('Community advice');
 await page.getByLabel('What support or information does it offer?').fill('A free guide to applying for benefits.');
 await page.getByLabel('Website').fill('https://example.org/guide');
 await page.getByRole('button',{name:'Send suggestion'}).click();
 await expect(page.getByRole('heading',{name:'Suggestion received'})).toBeVisible();
 await page.getByRole('button',{name:'Staff sign in',exact:true}).click();
 await completeStaffSignIn(page);
 await page.goto('/#/suggestions');
 await expect(page.getByRole('heading',{name:'Benefits guide'})).toBeVisible();
 await page.getByRole('button',{name:'Review suggestion'}).click();
 await expect(page.getByLabel('Service name')).toHaveValue('Benefits guide');
 await expect(page.getByRole('button',{name:'Prepare and fetch draft'})).toBeVisible();
});
