import { describe, expect, it } from 'vitest';
import { stepRows } from './NextStepsReport';

describe('stepRows', () => {
  it('leads with a phone call and lists only the details that are recorded', () => {
    const { action, rows } = stepRows({ publicPhone: '0117 000 1111', publicEmail: 'a@b.org', referralRoute: 'Self referral', address: 'Hall, , N/A, Bristol, BS1 1AA', cost: '' }, null);
    expect(action).toBe('Call 0117 000 1111');
    expect(Object.fromEntries(rows)).toEqual({ Phone: '0117 000 1111', Email: 'a@b.org', Address: 'Hall, Bristol, BS1 1AA', 'How to get this help': 'Refer yourself' });
  });
  it('falls back from email to website to address to a generic prompt', () => {
    expect(stepRows({ publicEmail: 'a@b.org' }, null).action).toBe('Email a@b.org');
    expect(stepRows({ url: 'https://charity.org.uk/help' }, null).action).toBe('Visit https://charity.org.uk/help');
    expect(stepRows({ url: 'http://www.example.com' }, 'BS1 1AA').action).toBe('Go to BS1 1AA');
    expect(stepRows(undefined, null).action).toBe('Look up their contact details');
  });
});
