import {test,expect} from './fixtures';
import {readFile} from 'node:fs/promises';
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('lp-directory-saved-v1',JSON.stringify([{id:'test:shortlist',name:'Community support',provider:'Local charity',postcode:'KT1 1AA'}])));
 await page.route('**/api/imports/service?id=test%3Ashortlist',route=>route.fulfill({json:{record:{id:'test:shortlist',name:'Community support',provider:'Local charity',description:'Support for carers <script>alert(1)</script>',publicPhone:'020 1234 5678',publicEmail:'help@example.org',url:'https://example.org/support',referralRoute:'Self-referral'}}}));
 await page.goto('/#/saved');
});
test('downloads a standalone shortlist with public contacts and safe source text',async({page})=>{
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download shortlist'}).click();const file=await downloaded;expect(file.suggestedFilename()).toBe('saved-services.html');const html=await readFile((await file.path())!,'utf8');expect(html).toContain('Phone: 020 1234 5678');expect(html).toContain('Email: help@example.org');expect(html).toContain('How to access: Self-referral');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');
});
test('prompts for recipient details and validates phone numbers',async({page})=>{
 await page.getByRole('button',{name:'Send to phone or email'}).click();const dialog=page.getByRole('dialog',{name:'Send your saved services'});await expect(dialog.getByLabel('Name',{exact:true})).toBeVisible();await dialog.getByLabel('Name',{exact:true}).fill('Sam');await dialog.getByLabel('Phone number').fill('123');await dialog.getByRole('button',{name:'Open text message'}).click();await expect(dialog.getByRole('alert')).toContainText('valid phone number');await dialog.getByLabel('Email',{exact:true}).check();await expect(dialog.getByLabel('Email address')).toHaveAttribute('type','email');await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Send to phone or email'})).toBeFocused();
});
