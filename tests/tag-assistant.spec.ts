import {completeStaffSignIn} from './helpers/staff-sign-in';
import {expect,test} from './fixtures';
test('suggested staff tags require explicit addition and saving',async({page})=>{
 let saves=0;
 await page.route('**/api/tags**',async route=>{if(route.request().method()==='POST')saves++;await route.fulfill({json:{tags:[]}});});
 await page.goto('/#/imports');await page.getByRole('button',{name:'Enter staff demo'}).click();await completeStaffSignIn(page);await page.getByLabel('Search the full service text').fill('anxiety');await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator('.import-service-link').first().click();
 const editor=page.getByRole('region',{name:'Service tags'});await expect(editor.getByRole('button',{name:'Save tags',exact:true})).toBeDisabled();
 await editor.getByLabel('New tag',{exact:true}).fill('Anxiety support');expect(saves).toBe(0);await expect(editor.getByRole('button',{name:'Save tags',exact:true})).toBeDisabled();
 await editor.getByRole('button',{name:'Add tag',exact:true}).click();await expect(editor.getByText('Anxiety support',{exact:true})).toBeVisible();await expect(editor.getByRole('button',{name:'Save tags',exact:true})).toBeEnabled();expect(saves).toBe(0);
 await editor.getByRole('button',{name:'Save tags',exact:true}).click();await expect(editor.getByRole('status')).toHaveText('Tags saved.');expect(saves).toBe(1);
});
