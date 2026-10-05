import {test as base,expect} from '@playwright/test';
export type {Page} from '@playwright/test';
// Browser suites never spend API credits or enqueue real web discoveries.
// Individual assistant tests override this route with their own controlled response.
export const test=base.extend<{assistantIsolation:void}>({assistantIsolation:[async({page},use)=>{await page.route('**/api/assistant',route=>route.fulfill({json:{mode:'local',summary:'Directory information',answer:'Review the listed services.',needs:[],nextSteps:[],citations:[],services:[],warnings:[],discoveries:[]}}));await use();},{auto:true}]});
export {expect};
