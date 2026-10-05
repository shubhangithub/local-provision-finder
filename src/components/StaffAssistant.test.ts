import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestStaffAssistance } from './StaffAssistant';
afterEach(()=>vi.unstubAllGlobals());
describe('staff assistance requests',()=>{
 it('sends only the selected suggestion ID and returns local checks',async()=>{
 const output={mode:'local',summary:'Check the website',answer:'Review the source.',needs:['Opening hours'],nextSteps:[],citations:[],warnings:[]};
 const mock=vi.fn().mockResolvedValue({ok:true,json:async()=>output});vi.stubGlobal('fetch',mock);
 expect(await requestStaffAssistance('suggestion','draft-1')).toEqual(output);
 expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({task:'suggestion',suggestionId:'draft-1'});
 });
 it('sends the selected feedback ID without changing the service',async()=>{
 const mock=vi.fn().mockResolvedValue({ok:true,json:async()=>({mode:'local'})});vi.stubGlobal('fetch',mock);
 await requestStaffAssistance('feedback','report-2');expect(mock).toHaveBeenCalledTimes(1);
 expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({task:'feedback',feedbackId:'report-2'});
 expect(mock.mock.calls[0][1].headers['X-Staff-Demo']).toBe('true');
 });
 it('reports API failures instead of showing an analysis',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'Report not found.'})}));
 await expect(requestStaffAssistance('feedback','missing')).rejects.toThrow('Report not found.');
 });
});
