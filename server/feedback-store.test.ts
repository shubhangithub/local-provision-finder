import { afterEach,describe,expect,it } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FeedbackStore } from './feedback-store';
const directories:string[]=[];
function store() {const path=mkdtempSync(join(tmpdir(),'dwp-feedback-'));directories.push(path);return new FeedbackStore(join(path,'feedback.sqlite'));}
afterEach(()=>directories.splice(0).forEach(path=>rmSync(path,{recursive:true,force:true})));
const service={id:'test-service',name:'Charity',publicPhone:'020 1234 5678',lastVerified:'2021-04-01',sourceUpdatedAt:'2023-09-01',address:'Original venue',postcode:'KT1 1AA',lat:51.4,lng:-0.3,locations:[{location:{lat:51.4,lon:-0.3}}],searchText:'Original source text'};
describe('feedback and reviewed corrections',()=>{
 it('persists reports without treating a user rating as a verified correction',()=>{
  const db=store();const entry=db.submit(service,{answers:{upToDate:'changed',issues:['publicPhone'],contact:'no'},note:'Number does not work'});
  expect(db.list()[0].id).toBe(entry.id);expect(db.corrected(service)).toEqual(service);db.close();
 });
 it('requires evidence before publishing a field correction and preserves old assurance dates',()=>{
  const db=store();const entry=db.submit(service,{answers:{upToDate:'changed',issues:['publicPhone']}});
  expect(()=>db.review(entry.id,service,{action:'corrected',field:'publicPhone',newValue:'020 9876 5432',note:'Provider confirmed',verified:false})).toThrow('Check the evidence');
  db.review(entry.id,service,{action:'corrected',field:'publicPhone',newValue:'020 9876 5432',note:'Provider confirmed',verified:true});
  const corrected=db.corrected(service);expect(corrected.publicPhone).toBe('020 9876 5432');expect(corrected.lastVerified).toBe('2021-04-01');expect(corrected.sourceUpdatedAt).toBe('2023-09-01');expect(service.publicPhone).toBe('020 1234 5678');
  expect(db.get(entry.id)?.status).toBe('resolved');expect(()=>db.review(entry.id,service,{action:'checked',note:'Checked again',verified:true})).toThrow('already been reviewed');db.close();
 });
 it('clears old venue coordinates when staff publish a new address',()=>{
  const db=store();const entry=db.submit(service,{answers:{upToDate:'changed',issues:['address']}});db.review(entry.id,service,{action:'corrected',field:'address',newValue:'New venue',note:'Provider confirms relocation',verified:true});
  const updated=db.corrected(service);expect(updated.address).toBe('New venue');expect(updated.lat).toBeNull();expect(updated.lng).toBeNull();expect(updated.postcode).toBeNull();expect(updated.locations).toEqual([]);db.close();
 });
 it('holds and dismisses reports with reasons; rejects unsupported fields',()=>{
  const db=store();expect(()=>db.submit(service,{answers:{upToDate:'changed',issues:['lastVerified']}})).toThrow('valid details');const entry=db.submit(service,{answers:{upToDate:'unsure',issues:[],recommendation:'no'}});
  db.review(entry.id,service,{action:'checking',note:'Contact provider'});expect(db.get(entry.id)?.status).toBe('checking');db.review(entry.id,service,{action:'dismissed',note:'Different service reported'});expect(db.get(entry.id)?.status).toBe('dismissed');expect(db.corrected(service)).toEqual(service);db.close();
 });
 it('keeps a proposed change only when trusted server code supplies it, never from a request body',()=>{
  const db=store();const sneaky=db.submit(service,{answers:{upToDate:'changed',issues:['cost']},proposed:{field:'cost',value:'Free',previous:'',quote:'x',source:'follow-up'}});
  expect(sneaky.proposed).toBeUndefined();expect(db.get(sneaky.id)?.proposed).toBeUndefined();
  const trusted=db.submit(service,{answers:{upToDate:'changed',issues:['cost']}},{field:'cost',value:'Free',previous:'£5',quote:'It is free now.',source:'follow-up'});
  expect(db.get(trusted.id)?.proposed).toEqual({field:'cost',value:'Free',previous:'£5',quote:'It is free now.',source:'follow-up'});
 });
});
