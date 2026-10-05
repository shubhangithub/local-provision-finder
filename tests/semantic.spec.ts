import {test,expect} from '@playwright/test';
test('semantic retrieval finds support without an exact phrase and keeps area filters',async ({request})=>{
  const q='I feel anxious and need someone to talk to';
  const response=await request.get('/api/imports',{params:{q,area:'Bristol',mode:'semantic'}});expect(response.ok()).toBe(true);
  const result=await response.json();expect(result.searchMode).toBe('semantic');expect(result.total).toBeGreaterThan(0);
  expect(result.records.slice(0,5).some((record:{name:string})=>/MindLine|Sanctuary|Talking Therapies|Support Groups/.test(record.name))).toBe(true);
  const keyword=await (await request.get('/api/imports',{params:{q,area:'Bristol',mode:'keyword'}})).json();expect(result.total).toBeGreaterThan(keyword.total);
  const first=(await (await request.get(`/api/imports/service?id=${encodeURIComponent(result.records[0].id)}`)).json()).record;expect(first.searchText.toLowerCase()).not.toContain(q.toLowerCase());
  const jobs=await (await request.get('/api/imports',{params:{q:'help getting back into a job',area:'Bristol',mode:'semantic'}})).json();expect(jobs.records.slice(0,5).some((record:{name:string})=>/Employment Support|Job Network|Jobcentre/.test(record.name))).toBe(true);
  const empty=await (await request.get('/api/imports',{params:{q:'xyzzy qqqq',area:'Bristol',mode:'semantic'}})).json();expect(empty.total).toBe(0);
});
