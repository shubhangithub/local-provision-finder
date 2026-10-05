import type {Page} from '@playwright/test';
export async function completeStaffSignIn(page:Page){
 const dialog=page.getByRole('dialog',{name:'Staff sign in',exact:true});
 await dialog.getByLabel('Username',{exact:true}).fill('admin');
 await dialog.getByLabel('Password',{exact:true}).fill('1234');
 await dialog.getByRole('button',{name:'Sign in',exact:true}).click();
}
export async function signInAsStaff(page:Page){
 await page.getByRole('button',{name:'Staff sign in',exact:true}).click();
 await completeStaffSignIn(page);
}
