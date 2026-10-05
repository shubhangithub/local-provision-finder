import { describe,it,expect } from 'vitest';
import { directorySites,nearestDistance,matchesArea,siteInBounds,type DirectoryRecord } from './directory';
const record:DirectoryRecord={id:'multi-site',name:'Support',provider:'Charity',description:'Help',searchText:'Help',source:'Connected Kingston',postcode:'KT1 1AA',lat:51.4,lng:-0.3,locations:[{location:{lat:51.4,lon:-0.3,postcode:'KT1 1AA'}},{location:{latitude:51.5,longitude:-0.1,addresses:[{postal_code:'SE1 1AA'}]}}]};
describe('recorded service locations',()=>{
 it('uses the closest of all sites, preserves coordinate zero and rejects invalid coordinates',()=>{
  const sites=directorySites(record);expect(sites).toHaveLength(2);expect(nearestDistance({lat:51.5,lng:-0.1},sites)).toBe(0);
  expect(directorySites({...record,locations:[{location:{lat:0,lon:0}}],lat:null,lng:null})[0].lat).toBe(0);
  expect(directorySites({...record,locations:[],lat:NaN,lng:2})[0].lat).toBeNull();
 });
 it('matches postcode coverage at any site without matching unrelated source prose',()=>{
  expect(matchesArea(record,directorySites(record),'SE1')).toBe(true);expect(matchesArea(record,directorySites(record),'kingston upon thames')).toBe(true);
  expect(matchesArea(record,directorySites(record),'Charity')).toBe(false);
 });
 it('requires a recorded site inside the visible map bounds',()=>{
  const bounds={west:-0.2,east:0,south:51.45,north:51.55};expect(directorySites(record).some(site=>siteInBounds(site,bounds))).toBe(true);
  expect(siteInBounds({lat:null,lng:null,postcode:'SE1',label:'No coordinates'},bounds)).toBe(false);
 });
});
