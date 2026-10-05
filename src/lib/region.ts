import { useCallback, useSyncExternalStore } from 'react';
import { areaCentre, directoryAreas, distanceMiles, normaliseArea, type MapBounds } from './directory';

/** The single app-wide search scope. `null` means all areas. */
export interface Region { label: string; area?: string; lat?: number; lng?: number; bounds?: MapBounds }

const KEY = 'lp-region-v1';
const CHANGED = 'region-changed';
const OPEN_MENU = 'region-menu-open';
const DEFAULT_MEETING_AREA = 'Bristol';

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function validBounds(value: unknown): value is MapBounds {
  const b = value as MapBounds | null;
  return !!b && finite(b.west) && finite(b.south) && finite(b.east) && finite(b.north);
}
export function parseRegion(raw: string | null | undefined): Region | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.label !== 'string' || !value.label.trim()) return null;
    const region: Region = { label: value.label.slice(0, 80) };
    if (typeof value.area === 'string' && value.area.trim()) region.area = value.area.slice(0, 80);
    if (finite(value.lat) && finite(value.lng)) { region.lat = value.lat; region.lng = value.lng; }
    if (validBounds(value.bounds)) region.bounds = value.bounds;
    return region;
  } catch { return null; }
}

/** Maps typed text to a known directory area id, otherwise returns the text unchanged (e.g. a postcode). */
export function resolveArea(text: string): string {
  const value = normaliseArea(text);
  const found = directoryAreas.find(item => normaliseArea(item.id) === value || normaliseArea(item.label) === value || (item.id === 'Buckinghamshire' && value === 'bucks'));
  return found ? found.id : text.trim();
}

export function regionBoundsParam(bounds: MapBounds | null | undefined): string | undefined {
  return bounds ? [bounds.west, bounds.south, bounds.east, bounds.north].join(',') : undefined;
}

/** The one place a region becomes `/api/imports` and assistant query parameters. */
export function regionParams(region: Region | null, bounds: MapBounds | null = region?.bounds ?? null): Record<string, string> {
  const params: Record<string, string> = {};
  if (region?.area) params.area = region.area;
  else if (region?.lat !== undefined && region.lng !== undefined) { params.lat = String(region.lat); params.lng = String(region.lng); }
  const boundsValue = regionBoundsParam(bounds);
  if (boundsValue) params.bounds = boundsValue;
  return params;
}

/** The same scope in the shape the assistant API expects. */
export function regionSearch(region: Region | null, bounds: MapBounds | null = region?.bounds ?? null) {
  return { area: region?.area, lat: region?.lat, lng: region?.lng, bounds: regionBoundsParam(bounds) };
}

/** Live meetings need one named area: the region's area, else the closest named area, else Bristol. */
export function meetingArea(region: Region | null): string {
  if (!region) return DEFAULT_MEETING_AREA;
  const named = region.area ? directoryAreas.find(item => item.id === resolveArea(region.area!)) : undefined;
  if (named) return named.id;
  const point = region.lat !== undefined && region.lng !== undefined ? { lat: region.lat, lng: region.lng }
    : region.bounds ? { lat: (region.bounds.north + region.bounds.south) / 2, lng: (region.bounds.east + region.bounds.west) / 2 }
    : region.area ? areaCentre(region.area) : null;
  if (!point) return DEFAULT_MEETING_AREA;
  const nearest = [...directoryAreas].sort((a, b) => distanceMiles(point, a) - distanceMiles(point, b))[0];
  return distanceMiles(point, nearest) < 35 ? nearest.id : DEFAULT_MEETING_AREA;
}

function readRaw(): string {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return memory; }
}
let memory = '';
export function writeRegion(region: Region | null) {
  const raw = region ? JSON.stringify(region) : '';
  memory = raw;
  try { if (raw) localStorage.setItem(KEY, raw); else localStorage.removeItem(KEY); } catch { /* kept in memory for this page */ }
  window.dispatchEvent(new Event(CHANGED));
}
export function openRegionMenu() { window.dispatchEvent(new Event(OPEN_MENU)); }
export const regionMenuEvent = OPEN_MENU;

function subscribe(callback: () => void) {
  window.addEventListener(CHANGED, callback);
  window.addEventListener('storage', callback);
  return () => { window.removeEventListener(CHANGED, callback); window.removeEventListener('storage', callback); };
}
const parsed = { raw: '\u0000', region: null as Region | null };
function snapshot(): Region | null {
  const raw = readRaw();
  if (raw !== parsed.raw) { parsed.raw = raw; parsed.region = parseRegion(raw); }
  return parsed.region;
}

export function readRegion(): Region | null { return snapshot(); }

export function useRegion(): [Region | null, (region: Region | null) => void] {
  const region = useSyncExternalStore(subscribe, snapshot, () => null);
  const set = useCallback((next: Region | null) => writeRegion(next), []);
  return [region, set];
}
