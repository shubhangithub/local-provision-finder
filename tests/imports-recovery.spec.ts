import {test,expect} from './fixtures';
test('catalogue failure shows an honest retry state and recovers existing records',async({page})=>{
 let fail=true;
 await page.route('**/api/imports?*',route=>fail?route.fulfill({status:503,json:{error:'Temporary outage'}}):route.fulfill({json:{ready:true,total:1,pageSize:20,report:null,records:[{id:'r1',name:'Existing service',provider:'Local charity',postcode:'BS1 1AA',source:'Bristol',description:'Support',categories:[],needs:[]}]}}));
 await page.goto('/#/imports');await page.getByRole('button',{name:'Enter staff demo'}).click();await expect(page.getByRole('alert')).toContainText('Could not load the directory.');await expect(page.getByText('0 source records')).toHaveCount(0);await expect(page.getByText('The first import is running')).toHaveCount(0);await expect(page.getByText(/npm run ingest/)).toHaveCount(0);
 fail=false;await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.getByRole('button',{name:'Existing service'})).toBeVisible();await expect(page.getByText('1 source records')).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
});
