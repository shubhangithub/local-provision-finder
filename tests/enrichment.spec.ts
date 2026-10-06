import AxeBuilder from '@axe-core/playwright';
import { completeStaffSignIn } from './helpers/staff-sign-in';
import { test,expect,type Page } from './fixtures';

const wcag=['wcag2a','wcag2aa','wcag21a','wcag21aa'];
const enrichment={enrichedAt:'2026-10-05T12:00:00.000Z',overwrites:[{id:'o1',field:'cost'}],facts:[
  {key:'session_balanceability',label:'Session balanceability',value:'Wednesday 11:00-12:00, booking required',sourceUrl:'https://hub.example.test/timetable.pdf',sourceType:'web',validTo:'2026-10-14',outdated:false},
  {key:'summer_taster',label:'Summer taster',value:'Mondays in July',sourceUrl:'https://hub.example.test/summer',sourceType:'web',validTo:'2025-07-31',outdated:true},
]};
async function firstService(page:Page) {const catalogue=await (await page.request.get('/api/imports?area=Kingston')).json();return catalogue.records[0] as {id:string;name:string};}
async function openAsStaff(page:Page,id:string) {
  await page.goto(`/#/directory/${encodeURIComponent(id)}`);
  const signIn=page.getByRole('button',{name:'Staff sign in',exact:true});
  if (await signIn.isVisible()) {await signIn.click();await completeStaffSignIn(page);}
}
const enrichmentUrl=(url:URL)=>url.pathname==='/api/enrichment';
const detail=(over:Record<string,unknown>={})=>({configured:true,run:null,overwrites:[],facts:[],gaps:[],candidates:[],notes:'',unavailableSources:[],...over});

test('Enrich is disabled with the reason when the enrichment service is not configured',async({page})=>{
  const service=await firstService(page);
  await page.route(enrichmentUrl,route=>route.fulfill({json:detail({configured:false})}));
  await openAsStaff(page,service.id);
  await expect(page.getByRole('button',{name:'Enrich service profile'})).toBeDisabled();
  await expect(page.getByText('Web enrichment is not configured. Set GOV_HACK_URL and GOV_HACK_API_TOKEN on the server.')).toBeVisible();
});

test('staff enrich a service, see progress, and an ambiguous result changes nothing and offers a retry',async({page})=>{
  test.setTimeout(20_000);
  const service=await firstService(page);let state=detail();let started:Record<string,unknown>|null=null;
  await page.route(enrichmentUrl,async route=>{
    if (route.request().method()==='POST') {started=route.request().postDataJSON();state=detail({run:{status:'running',outcome:null,error:null,startedAt:new Date().toISOString(),finishedAt:null}});return route.fulfill({status:202,json:state});}
    return route.fulfill({json:state});
  });
  await openAsStaff(page,service.id);
  await page.getByRole('button',{name:'Enrich service profile'}).click();
  expect(started).toMatchObject({serviceId:service.id});
  await expect(page.getByRole('button',{name:'Enriching…'})).toBeDisabled();await expect(page.locator('.enrich-button .spinner')).toBeVisible();await expect(page.getByRole('status').filter({hasText:'Researching this service'})).toBeVisible();
  state=detail({run:{status:'completed',outcome:'ambiguous',error:null,startedAt:new Date().toISOString(),finishedAt:new Date().toISOString()},candidates:[{name:'Elmhurst Hub (Aylesbury)',url:'https://hub.example.test',locality:'Aylesbury'}]});
  await expect(page.getByText('Could not identify this service. Nothing was changed.')).toBeVisible({timeout:6000});
  await expect(page.getByRole('list',{name:'Changes made by enrichment'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Refresh service profile'})).toBeEnabled();
});
});

test('a failed run is shown and a finished one lists what changed and what could not be confirmed',async({page})=>{
  const service=await firstService(page);
  const when=new Date().toISOString();
  await page.route(enrichmentUrl,route=>route.fulfill({json:detail({run:{status:'error',outcome:null,error:'The agent process failed.',startedAt:when,finishedAt:when}})}));
  await openAsStaff(page,service.id);
  await expect(page.getByText('Enrichment failed: The agent process failed.')).toBeVisible();
  await page.unroute(enrichmentUrl);
  await page.route(enrichmentUrl,route=>route.fulfill({json:detail({run:{status:'completed',outcome:'found',error:null,startedAt:when,finishedAt:when},overwrites:[{id:'o1',field:'cost',original:'',value:'Five pounds a session',sourceUrl:'https://hub.example.test/cost',quote:'It is five pounds a session',appliedAt:when}],gaps:[{topic:'eligibility',reason:'missing',detail:'No age limit is stated.',status:'needs_human',flag_reason:'A person needs to check.'}]})}));
  await page.reload();await openAsStaff(page,service.id);
  // The change is shown on the field it changed, with an undo, not in the sidebar.
  const cost=page.locator('.about-facts > div').filter({hasText:'Cost'});
  await expect(cost.locator('.row-diff')).toContainText('Was not listed');await expect(cost.getByRole('button',{name:/Undo cost change/})).toBeVisible();
  await expect(page.getByRole('list',{name:'Changes made by enrichment'})).toHaveCount(0);await expect(page.getByText('1 detail updated')).toBeVisible();
  await expect(page.getByText('1 gap not confirmed')).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(wcag).analyze()).violations).toEqual([]);
});

test('enriched details are merged into About this service with bold labels, and render markdown safely',async({page})=>{
  const service=await firstService(page);
  const merged={enrichedAt:'2026-10-05T12:00:00.000Z',overwrites:[{id:'o1',field:'cost',sourceUrl:'https://hub.example.test/cost'}],facts:[
    {key:'session_balanceability',label:'Session balanceability',value:'- Wednesday 11:00-12:00\n- Friday 10:00-11:00 <script>window.hacked=1</script>',sourceUrl:'https://hub.example.test/timetable.pdf',sourceType:'web',validTo:'2026-10-14',outdated:false},
    {key:'summer_taster',label:'Summer taster',value:'Mondays in July',sourceUrl:'https://hub.example.test/summer',sourceType:'web',validTo:'2025-07-31',outdated:true},
  ]};
  await page.route('**/api/imports/service?*',async route=>{const response=await route.fetch();const body=await response.json();await route.fulfill({response,json:{record:{...body.record,cost:'**Free** for under fives',enrichment:merged}}});});
  await page.goto(`/#/directory/${encodeURIComponent(service.id)}`);
  const about=page.locator('.panel').filter({has:page.getByRole('heading',{name:'About this service'})});
  await expect(about.locator('.about-facts')).toBeVisible();
  await expect(about.locator('dd').filter({hasText:'Free for under fives'}).locator('strong')).toHaveText('Free');
  await expect(about.getByText('Session balanceability')).toBeVisible();await expect(about.getByRole('listitem').filter({hasText:'Wednesday 11:00-12:00'})).toBeVisible();
  await expect(about.locator('dt').filter({hasText:'Cost'})).toHaveCSS('font-weight','700');
  await expect(about.getByText('Out of date: ended 2025-07-31')).toBeVisible();await expect(about.getByText(/not been reviewed by staff/)).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {hacked?:number}).hacked)).toBeUndefined();
  await expect(page.getByRole('region',{name:/From the web/})).toHaveCount(0);await expect(page.getByRole('button',{name:'Enrich service profile'})).toHaveCount(0);
  expect((await new AxeBuilder({page}).withTags(wcag).analyze()).violations).toEqual([]);
});

test('staff see recently enriched changes with evidence and can revert one',async({page})=>{
  const when=new Date().toISOString();let reverted:string|null=null;
  let items=[{id:'o1',serviceId:'bucks:1',serviceName:'Elmhurst Family Hub',field:'cost',original:'Free',value:'Five pounds',sourceUrl:'https://hub.example.test/cost',quote:'It is five pounds',appliedAt:when,revertedAt:null as string|null}];
  await page.route('**/api/enrichment/recent',route=>route.fulfill({json:{configured:true,overwrites:items}}));
  await page.route('**/api/enrichment/revert',route=>{reverted=route.request().postDataJSON().id;items=items.map(item=>({...item,revertedAt:when}));return route.fulfill({json:{overwrite:items[0]}});});
  await page.goto('/#/enriched');await page.getByRole('button',{name:'Enter staff workspace'}).click();await completeStaffSignIn(page);
  await expect(page.getByRole('heading',{name:'Recently enriched'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Elmhurst Family Hub'})).toBeVisible();await expect(page.getByRole('listitem').filter({hasText:'Cost: Free'})).toContainText('Five pounds');
  expect((await new AxeBuilder({page}).withTags(wcag).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:/^Undo/}).click();
  await expect(page.getByText('(reverted)')).toBeVisible();expect(reverted).toBe('o1');await expect(page.getByRole('button',{name:/^Undo/})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Recently enriched'})).toHaveAttribute('aria-current','page');
});
