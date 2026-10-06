export interface DirectoryLocation {
  location?: {
    latitude?: unknown; longitude?: unknown; lat?: unknown; lon?: unknown;
    postcode?: unknown; name?: unknown; address_line_1?: unknown;
    addresses?: { postal_code?: unknown; address_1?: unknown }[];
  };
}
export interface EnrichedFact {key:string;label:string;value:string;sourceUrl?:string;sourceType:string;validFrom?:string;validTo?:string;outdated:boolean}
export interface DirectoryEnrichment {enrichedAt:string;facts:EnrichedFact[];overwrites:{id:string;field:string;sourceUrl:string}[]}
export interface DirectoryRecord {
  id: string; name: string; provider: string; description: string; searchText: string;
  source: string; postcode: string | null; lat: number | null; lng: number | null;
  address?: string | null; categories?: string[]; needs?: string[];
  eligibilitySummary?: string | null; accessibility?: string[]; cost?: string | null;
  enrichment?:DirectoryEnrichment;openingTimes?: string | null; tags?:string[]; availability?: string; locations?: DirectoryLocation[];
}
export interface DirectorySite { lat: number | null; lng: number | null; postcode: string | null; label: string }
export interface DirectorySummary {
  urgentSupportEvidence?:string;
  id: string; name: string; provider: string; postcode: string | null;
  distanceMiles: number | null; sites: DirectorySite[]; snippet: string; tags: string[];
}
export interface MapService { id: string; name: string; provider: string; sites: DirectorySite[] }
export interface DirectoryResponse {
  total: number; records: DirectorySummary[]; mapRecords: MapService[];
  page: number; pageSize: number; mappedCount: number; unmappedCount: number;
  searchMode: 'browse' | 'semantic' | 'keyword'; ready: boolean;
}
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
// The directories write 0,0 (and other points outside the UK) where a location is unknown, and a pin there is
// thousands of miles from the service. Treat those as having no coordinates so the service is listed but not plotted.
const inUnitedKingdom=(lat:number,lng:number)=>lat>=49 && lat<=61 && lng>=-11 && lng<=2.5;
function coordinates(lat: unknown, lng: unknown): {lat: number | null; lng: number | null} {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && inUnitedKingdom(lat,lng) ? {lat,lng} : {lat:null,lng:null};
}
export function directorySites(record: DirectoryRecord): DirectorySite[] {
  const sites = (record.locations ?? []).flatMap(site => {
    const loc = site.location;
    if (!loc) return [];
    return [{...coordinates(loc.latitude ?? loc.lat,loc.longitude ?? loc.lon), postcode:text(loc.postcode) ?? text(loc.addresses?.[0]?.postal_code), label:text(loc.name) ?? text(loc.address_line_1) ?? text(loc.addresses?.[0]?.address_1) ?? record.name}];
  });
  const primary = {...coordinates(record.lat,record.lng),postcode:record.postcode,label:record.address || record.name};
  if (!sites.length || (primary.lat !== null && !sites.some(site => site.lat === primary.lat && site.lng === primary.lng))) sites.unshift(primary);
  const seen = new Set<string>();
  return sites.filter(site => { const key = JSON.stringify([site.lat,site.lng,site.postcode]); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function distanceMiles(origin: {lat: number; lng: number}, site: {lat: number; lng: number}): number {
  const rad = Math.PI/180;
  const a = Math.sin((site.lat-origin.lat)*rad/2)**2 + Math.cos(origin.lat*rad)*Math.cos(site.lat*rad)*Math.sin((site.lng-origin.lng)*rad/2)**2;
  return 3958.8*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}
export function nearestDistance(origin: {lat:number;lng:number}, sites: DirectorySite[]): number | null {
  const distances = sites.flatMap(site => site.lat !== null && site.lng !== null ? [distanceMiles(origin,{lat:site.lat,lng:site.lng})] : []);
  return distances.length ? Math.min(...distances) : null;
}
export function normaliseArea(area: string): string { return area.trim().toLowerCase().replace(/\s+/g,''); }
export function matchesArea(record: DirectoryRecord, sites: DirectorySite[], area: string): boolean {
  const normal = normaliseArea(area);
  if (!normal) return true;
  if (normal === 'buckinghamshire' || normal === 'bucks') return record.source.includes('Buckinghamshire');
  if (normal === 'bristol') return record.source.includes('Bristol');
  if (normal === 'kingston' || normal === 'kingstonuponthames') return record.source.includes('Kingston');
  return [record.postcode,...sites.map(site => site.postcode)].some(postcode => postcode && normaliseArea(postcode).startsWith(normal));
}
export interface MapBounds {west:number;south:number;east:number;north:number}
export function siteInBounds(site:DirectorySite,bounds:MapBounds):boolean {
  return site.lat!==null && site.lng!==null && site.lat>=bounds.south && site.lat<=bounds.north && site.lng>=bounds.west && site.lng<=bounds.east;
}
export const directoryAreas = [
  {id:'Bristol',label:'Bristol',directory:'Well Aware directory',source:'Bristol',lat:51.4545,lng:-2.5879},
  {id:'Kingston',label:'Kingston upon Thames',directory:'Connected Kingston directory',source:'Kingston',lat:51.4123,lng:-0.3007},
  {id:'Buckinghamshire',label:'Buckinghamshire',directory:'Family Information Service',source:'Buckinghamshire',lat:51.8167,lng:-0.814},
] as const;
export function areaCentre(area?:string):{lat:number;lng:number} {
  const value=normaliseArea(area ?? '');
  const found=directoryAreas.find(item => normaliseArea(item.id)===value || normaliseArea(item.label)===value);
  if (found) return {lat:found.lat,lng:found.lng};
  if (/^kt/.test(value)) return {lat:51.4123,lng:-0.3007};
  if (/^(hp|mk|sl|ox)/.test(value)) return {lat:51.8167,lng:-0.814};
  return {lat:51.4545,lng:-2.5879};
}
