import { needsHelpToday, urgencySearchText, urgentServiceEvidence, matchesUrgentTopic } from '../src/lib/urgency.ts';
import { directoryAreas, normaliseArea, directorySites, matchesArea, siteInBounds, nearestDistance, distanceMiles, type DirectoryRecord, type DirectoryResponse, type DirectorySite, type MapBounds } from '../src/lib/directory.ts';
import { semanticMatches } from './semantic.ts';
const subjectPatterns=[[/\b(job|jobs|employment|unemployed|cv|career)\b|(?:back|return|finding|find).{0,20}\bwork\b/i,/employment|job|career|employability|cv writing/i],[/\b(bills?|money|debts?|financial|benefits?|budget)\b/i,/money|debt|financial|benefit|budget/i],[/anxi|anxious|panic|depress|mental|someone to talk|counsell/i,/mental|counsell|anxiety|talking therap|mindline/i]];
const stopWords = new Set(['a','an','and','are','as','at','be','but','can','do','for','from','get','have','i','in','is','it','me','my','near','need','of','on','or','that','the','this','to','want','with','you','your']);
function queryTerms(query: string): string[] { return [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].filter(term => !stopWords.has(term)); }
export function matchingServiceTags(tags: string[] | undefined, query: string): string[] {
  const terms = new Set(queryTerms(query));
  return (tags ?? []).filter(tag => {
    const significant = queryTerms(tag);
    return significant.length > 0 && significant.every(term => terms.has(term));
  });
}
function lexicalMatch(record: DirectoryRecord, query: string): {score:number; exact:boolean; snippet:string} {
  const body=record.searchText.toLowerCase(); const name=record.name.toLowerCase();
  const phrase=query.trim().toLowerCase(); const terms=queryTerms(query);
  const hits=terms.filter(term => body.includes(term)).length;
  const named=terms.filter(term => name.includes(term)).length;
  const subject=subjectPatterns.some(([queryPattern,servicePattern]) => queryPattern.test(query) && servicePattern.test([record.name,...(record.needs ?? []),...(record.categories ?? [])].join(' '))) ? 0.12 : 0;
  const exact=phrase.length>=3 && body.includes(phrase);
  return {score:subject+(terms.length ? hits/terms.length : 0)*0.06 + (terms.length ? named/terms.length : 0)*0.1 + (exact ? 0.12 : 0),exact,snippet:record.description};
}
function nearbyDirectory(record: DirectoryRecord, origin:{lat:number;lng:number}): boolean {
  const area = directoryAreas.find(item=>record.source.includes(item.source));
  return !!area && distanceMiles(origin,area)<35;
}
export class SearchInputError extends Error {}
export async function searchDirectory(records: DirectoryRecord[], params: URLSearchParams): Promise<DirectoryResponse> {
  const originalQuery=(params.get('q') ?? '').trim().slice(0,250);
  const urgent=needsHelpToday(originalQuery,params.get('urgency')==='normal'?'normal':params.get('urgency')==='today'?'today':'auto');
  const query=urgent?urgencySearchText(originalQuery):originalQuery;
  const area=(params.get('area') ?? '').trim().slice(0,80);
  const nearby=params.has('lat');
  const lat=Number(params.get('lat')), lng=Number(params.get('lng'));
  const radius=params.has('radius') ? Number(params.get('radius')) : 10;
  if (nearby && (!params.has('lng') || !(params.get('lat') ?? '').trim() || !(params.get('lng') ?? '').trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180)) throw new SearchInputError('Invalid coordinates.');
  if (!Number.isFinite(radius) || radius<1 || radius>50) throw new SearchInputError('Choose a distance from 1 to 50 miles.');
  let bounds:MapBounds | null=null;
  if (params.has('bounds')) {
    const parts=(params.get('bounds') ?? '').split(',');const values=parts.map(Number);
    if (parts.length!==4 || parts.some(part => !part.trim()) || values.some(value => !Number.isFinite(value)) || values[0]<-180 || values[2]>180 || values[1]<-90 || values[3]>90 || values[0]>=values[2] || values[1]>=values[3]) throw new SearchInputError('Invalid map area.');
    bounds={west:values[0],south:values[1],east:values[2],north:values[3]};
  }
  // A named directory (Bristol, Kingston, Buckinghamshire) is a hard scope: moving or zooming the map narrows within it but never pulls in another directory.
  const namedArea=directoryAreas.find(item => normaliseArea(item.id)===normaliseArea(area) || normaliseArea(item.label)===normaliseArea(area));
  const origin={lat,lng}; const includeUnknown=params.get('unknown')!=='0';
  const page=Math.max(1,Math.min(10000,Math.floor(Number(params.get('page')) || 1))); const pageSize=20;
  const candidates=records.filter(record => record.availability!=='Removed at source' && record.availability!=='Closed').map(record => {
    const sites=directorySites(record);
    const distance=nearby ? nearestDistance(origin,sites) : null;
    return {record,sites,distance,score:0,tagMatch:false,snippet:record.description,urgentEvidence:urgentServiceEvidence(record)};
  }).filter(item => bounds ? (!namedArea || matchesArea(item.record,item.sites,area)) && (item.sites.some(site => siteInBounds(site,bounds!)) || includeUnknown && item.sites.every(site => site.lat===null) && nearbyDirectory(item.record,{lat:(bounds.north+bounds.south)/2,lng:(bounds.east+bounds.west)/2})) : nearby ? item.distance === null ? includeUnknown && nearbyDirectory(item.record,origin) : item.distance<=radius : matchesArea(item.record,item.sites,area));
  let semantic=null;
  if (query && params.get('mode')!=='keyword') {
    try {semantic=await semanticMatches(query,candidates.map(item => item.record));}
    catch (error) {console.error('Local semantic search unavailable:', error instanceof Error ? error.message : 'Unknown error');}
  }
  let ranked=candidates;
  if (query) {
    const scored=candidates.map(item => {
      const lexical=lexicalMatch(item.record,query);
      const match=semantic?.get(item.record.id);
      const tagMatch=matchingServiceTags(item.record.tags,query).length>0;
      return {...item,tagMatch,score:(match?.score ?? 0)+lexical.score,snippet:match?.snippet || lexical.snippet,semanticScore:match?.score ?? 0,exact:lexical.exact};
    });
    const best=Math.max(0,...scored.map(item => item.semanticScore));
    ranked=scored.filter(item => item.tagMatch || urgent && matchesUrgentTopic(item.record,originalQuery) || (semantic ? item.exact || (item.semanticScore>=0.32 && item.semanticScore>=best-0.16) : item.exact || queryTerms(query).length>0 && queryTerms(query).every(term => item.record.searchText.toLowerCase().includes(term))));
  }
  ranked.sort((a,b) => (urgent?Number(!!b.urgentEvidence)-Number(!!a.urgentEvidence):0) || (query ? Number(b.tagMatch)-Number(a.tagMatch) || b.score-a.score || (a.distance ?? Infinity)-(b.distance ?? Infinity) || a.record.name.localeCompare(b.record.name) : nearby ? (a.distance ?? Infinity)-(b.distance ?? Infinity) || a.record.name.localeCompare(b.record.name) : a.record.name.localeCompare(b.record.name)));
  // In a named directory only plot sites near it; a pin far away is a placeholder or a mistake.
  const mappedSites = (sites: DirectorySite[]) => sites.filter(site => site.lat!==null && site.lng!==null && (bounds ? siteInBounds(site,bounds) : nearby ? distanceMiles(origin,{lat:site.lat!,lng:site.lng!})<=radius : !namedArea || distanceMiles(namedArea,{lat:site.lat!,lng:site.lng!})<=40));
  const mapRecords=ranked.flatMap(item => {const sites=mappedSites(item.sites);return sites.length ? [{id:item.record.id,name:item.record.name,provider:item.record.provider,sites}] : [];});
  return {total:ranked.length,page,pageSize,ready:true,searchMode:query ? semantic ? 'semantic' : 'keyword' : 'browse',mappedCount:mapRecords.length,unmappedCount:ranked.length-mapRecords.length,mapRecords,records:ranked.slice((page-1)*pageSize,page*pageSize).map(item => ({id:item.record.id,name:item.record.name,provider:item.record.provider,urgentSupportEvidence:item.urgentEvidence??undefined,tags:item.record.tags ?? [],postcode:item.record.postcode,distanceMiles:item.distance,sites:mappedSites(item.sites),snippet:item.snippet.replace(/^name:\s*/i,'').slice(0,220)}))};
}
