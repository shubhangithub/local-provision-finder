import { describe,expect,it } from 'vitest';
import { reportFromFinding } from './follow-up-findings';
const name='The London Kettlebell Club';
describe('call findings become report drafts',()=>{
  it('reports a closure as closed availability with the quote',()=>{
    const draft=reportFromFinding({name,operating:{state:'closed_permanently',confidence:'confirmed',quote:"They've closed for good."}},name)!;
    expect(draft.answers).toEqual({upToDate:'changed',availability:'closed',issues:['availability']});
    expect(draft.proposal).toEqual({field:'availability',value:'Closed',quote:"They've closed for good."});expect(draft.note).toContain("The London Kettlebell Club has closed permanently: \"They've closed for good.\"");
  });
  it('maps changed details to the matching fields, and keeps unmapped ones in the note only',()=>{
    const draft=reportFromFinding({name,details:[{category:'price',said:'twelve pounds now',confidence:'confirmed',quote:'It is twelve pounds now.'},{category:'times',said:'moved to Thursday',confidence:'hedged',quote:'I think Thursday.'},{category:'other',said:'new coach',confidence:'confirmed',quote:'There is a new coach.'}]},name)!;
    expect(draft.answers.issues).toEqual(['cost','openingTimes']);
    expect(draft.proposal).toEqual({field:'cost',value:'twelve pounds now',quote:'It is twelve pounds now.'});expect(draft.answers.availability).toBeUndefined();
    expect(draft.note).toContain('Changed price: twelve pounds now');expect(draft.note).toContain('(said with doubt)');expect(draft.note).toContain('Detail: new coach');
  });
  it('treats a move as an address report, not a closure',()=>{
    const draft=reportFromFinding({name,operating:{state:'moved',confidence:'confirmed',quote:'They are on Mill Road now.'}},name)!;
    expect(draft.answers).toEqual({upToDate:'changed',issues:['address']});expect(draft.proposal).toBeUndefined();
  });
  it('offers one-click apply only for clearly stated findings, not doubtful ones',()=>{
    expect(reportFromFinding({name,operating:{state:'closed_permanently',confidence:'hedged',quote:'I think it shut.'}},name)!.proposal).toBeUndefined();
    expect(reportFromFinding({name,details:[{category:'times',said:'Thursday',confidence:'hedged',quote:'Maybe Thursday.'}]},name)!.proposal).toBeUndefined();
    expect(reportFromFinding({name,details:[{category:'other',said:'new coach',confidence:'confirmed',quote:'A new coach.'}]},name)!.proposal).toBeUndefined();
  });
  it('makes nothing when there is nothing about the service, or no quote supports it',()=>{
    expect(reportFromFinding({name,status:'contacted',feedback:'it was fine',quote:'It was fine.'},name)).toBeNull();
    expect(reportFromFinding({name,operating:{state:'open',quote:'Still open.'}},name)).toBeNull();
    expect(reportFromFinding({name,operating:{state:'closed_permanently'}},name)).toBeNull();
    expect(reportFromFinding({name,details:[{category:'price',said:'twelve'}]},name)).toBeNull();
  });
  it('keeps the note within the report limit',()=>{expect(reportFromFinding({name,details:[{category:'price',said:'x'.repeat(2000),quote:'y'.repeat(200)}]},name)!.note.length).toBeLessThanOrEqual(1000);});
});
