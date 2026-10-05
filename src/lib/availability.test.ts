import {it,expect} from 'vitest';
import {availabilityCaption} from './availability';
it('shows the age of a real staff availability check',()=>{expect(availabilityCaption({status:'Open',confirmedAt:'2026-10-02T12:00:00Z'},Date.parse('2026-10-05T12:00:00Z'))).toBe('Availability confirmed 3 days ago');});
