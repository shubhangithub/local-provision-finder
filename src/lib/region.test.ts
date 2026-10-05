import { describe, expect, it } from 'vitest';
import { meetingArea, parseRegion, regionParams, resolveArea } from './region';

describe('region', () => {
  it('parses valid and rejects invalid stored data', () => {
    expect(parseRegion('')).toBeNull();
    expect(parseRegion('not json')).toBeNull();
    expect(parseRegion('{"label":""}')).toBeNull();
    expect(parseRegion('{"label":"Bristol","area":"Bristol","lat":"x"}')).toEqual({ label: 'Bristol', area: 'Bristol' });
    expect(parseRegion('{"label":"Here","lat":51.4,"lng":-2.5}')).toEqual({ label: 'Here', lat: 51.4, lng: -2.5 });
    expect(parseRegion('{"label":"Box","bounds":{"west":1,"south":2,"east":3,"north":"4"}}')).toEqual({ label: 'Box' });
  });
  it('resolves typed area names', () => {
    expect(resolveArea(' bristol ')).toBe('Bristol');
    expect(resolveArea('Kingston upon Thames')).toBe('Kingston');
    expect(resolveArea('Bucks')).toBe('Buckinghamshire');
    expect(resolveArea('BS1 4DJ')).toBe('BS1 4DJ');
  });
  it('builds query params once', () => {
    expect(regionParams(null)).toEqual({});
    expect(regionParams({ label: 'Bristol', area: 'Bristol' })).toEqual({ area: 'Bristol' });
    expect(regionParams({ label: 'Here', lat: 1, lng: 2 })).toEqual({ lat: '1', lng: '2' });
    expect(regionParams({ label: 'Here', lat: 1, lng: 2 }, { west: 1, south: 2, east: 3, north: 4 })).toEqual({ lat: '1', lng: '2', bounds: '1,2,3,4' });
  });
  it('picks a meeting area', () => {
    expect(meetingArea(null)).toBe('Bristol');
    expect(meetingArea({ label: 'Kingston', area: 'Kingston' })).toBe('Kingston');
    expect(meetingArea({ label: 'Here', lat: 51.41, lng: -0.3 })).toBe('Kingston');
    expect(meetingArea({ label: 'Far', lat: 55, lng: -3 })).toBe('Bristol');
    expect(meetingArea({ label: 'KT1', area: 'KT1' })).toBe('Kingston');
  });
});
